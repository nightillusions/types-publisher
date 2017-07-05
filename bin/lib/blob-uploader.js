"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const fs_extra_1 = require("fs-extra");
const path = require("path");
const logging_1 = require("../util/logging");
const util_1 = require("../util/util");
const azure_container_1 = require("./azure-container");
const maxNumberOfOldLogsDirectories = 5;
function uploadBlobsAndUpdateIssue(timeStamp) {
    return __awaiter(this, void 0, void 0, function* () {
        const container = yield azure_container_1.default.create();
        yield container.ensureCreated({ publicAccessLevel: "blob" });
        yield container.setCorsProperties();
        const [dataUrls, logUrls] = yield uploadBlobs(container, timeStamp);
        yield uploadIndex(container, timeStamp, dataUrls, logUrls);
    });
}
exports.default = uploadBlobsAndUpdateIssue;
// View uploaded files at: https://ms.portal.azure.com under "typespublisher"
function uploadBlobs(container, timeStamp) {
    return __awaiter(this, void 0, void 0, function* () {
        const [log, logResult] = logging_1.logger();
        const [dataUrls, logUrls] = yield Promise.all([
            yield uploadDirectory(container, "data", "data", log),
            yield uploadLogs(container, timeStamp, log)
        ]);
        // Finally, output blob logs and upload them.
        const blobLogs = "upload-blobs.md";
        yield logging_1.writeLog(blobLogs, logResult());
        logUrls.push(yield uploadFile(container, logsUploadedLocation(timeStamp) + "/" + blobLogs, logging_1.logPath(blobLogs)));
        return [dataUrls, logUrls];
    });
}
const logsDirectoryName = "logs";
const logsPrefix = logsDirectoryName + "/";
function logsUploadedLocation(timeStamp) {
    return logsPrefix + timeStamp;
}
function uploadLogs(container, timeStamp, log) {
    return __awaiter(this, void 0, void 0, function* () {
        yield removeOldDirectories(container, logsPrefix, maxNumberOfOldLogsDirectories - 1, log);
        return yield uploadDirectory(container, logsUploadedLocation(timeStamp), logsDirectoryName, log, f => f !== "upload-blobs.md");
    });
}
function uploadDirectory(container, uploadedDirPath, dirPath, log, filter) {
    return __awaiter(this, void 0, void 0, function* () {
        let files = yield fs_extra_1.readdir(dirPath);
        if (filter) {
            files = files.filter(filter);
        }
        return yield Promise.all(files.map(fileName => {
            const fullPath = util_1.joinPaths(dirPath, fileName);
            const blobName = util_1.joinPaths(uploadedDirPath, fileName);
            return logAndUploadFile(container, blobName, fullPath, log);
        }));
    });
}
function logAndUploadFile(container, blobName, filePath, log) {
    return __awaiter(this, void 0, void 0, function* () {
        const url = azure_container_1.urlOfBlob(blobName);
        log(`Uploading ${filePath} to ${url}`);
        yield container.createBlobFromFile(blobName, filePath);
        return url;
    });
}
function uploadFile(container, blobName, filePath) {
    return __awaiter(this, void 0, void 0, function* () {
        const url = azure_container_1.urlOfBlob(blobName);
        yield container.createBlobFromFile(blobName, filePath);
        return url;
    });
}
function deleteDirectory(container, uploadedDirPath, log) {
    return __awaiter(this, void 0, void 0, function* () {
        const blobs = yield container.listBlobs(uploadedDirPath);
        const blobNames = blobs.map(b => b.name);
        log(`Deleting directory ${uploadedDirPath}: delete files ${blobNames}`);
        yield Promise.all(blobNames.map(b => container.deleteBlob(b)));
    });
}
function removeOldDirectories(container, prefix, maxDirectories, log) {
    return __awaiter(this, void 0, void 0, function* () {
        const list = yield container.listBlobs(prefix);
        const dirNames = util_1.unique(list.map(({ name }) => {
            assert(name.startsWith(prefix));
            return path.dirname(name.slice(prefix.length));
        }));
        if (dirNames.length <= maxDirectories) {
            log(`No need to remove old directories: have ${dirNames.length}, can go up to ${maxDirectories}.`);
            return;
        }
        // For ISO 8601 times, sorting lexicographically *is* sorting by time.
        const sortedNames = dirNames.sort();
        const toDelete = sortedNames.slice(0, sortedNames.length - maxDirectories);
        log(`Too many old logs, so removing the following directories: [${toDelete}]`);
        yield Promise.all(toDelete.map(d => deleteDirectory(container, prefix + d, log)));
    });
}
// Provides links to the latest blobs.
// These are at: https://typespublisher.blob.core.windows.net/typespublisher/index.html
function uploadIndex(container, timeStamp, dataUrls, logUrls) {
    return container.createBlobFromText("index.html", createIndex());
    function createIndex() {
        const lines = [];
        lines.push("<html><head></head><body>");
        lines.push(`<h3>Here is the latest data as of **${timeStamp}**:</h3>`);
        lines.push("<h4>Data</h4>");
        lines.push(...dataUrls.map(link));
        lines.push("<h4>Logs</h4>");
        lines.push(...logUrls.map(link));
        lines.push("</body></html>");
        return lines.join("\n");
        function link(url) {
            const short = url.slice(url.lastIndexOf("/") + 1);
            return `<li><a href='${url}'>${short}</a></li>`;
        }
    }
}
//# sourceMappingURL=blob-uploader.js.map