"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listFunctionGroupIncludes = listFunctionGroupIncludes;
const functionGroupNodes_1 = require("./functionGroupNodes");
async function listFunctionGroupIncludes(connection, functionGroupName) {
    return (0, functionGroupNodes_1.listFunctionGroupChildren)(connection, functionGroupName, 'FUGR/I');
}
