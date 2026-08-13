"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DdicActivation = void 0;
const activationGraph_1 = require("./activationGraph");
class DdicActivation {
    connection;
    logger;
    kind = 'ddicActivation';
    constructor(connection, logger) {
        this.connection = connection;
        this.logger = logger;
    }
    async getGraph(options) {
        return (0, activationGraph_1.getActivationGraph)(this.connection, options);
    }
}
exports.DdicActivation = DdicActivation;
