"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listFunctionModules = listFunctionModules;
const functionGroupNodes_1 = require("./functionGroupNodes");
async function listFunctionModules(connection, functionGroupName) {
    return (0, functionGroupNodes_1.listFunctionGroupChildren)(connection, functionGroupName, 'FUGR/FF');
}
