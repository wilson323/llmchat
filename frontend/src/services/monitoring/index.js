"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalPerformanceMonitor = exports.globalErrorHandler = exports.ErrorHandlingService = exports.PerformanceMonitor = void 0;
;
const PerformanceMonitor_1 = require("./PerformanceMonitor");
var PerformanceMonitor_2 = require("./PerformanceMonitor");
Object.defineProperty(exports, "PerformanceMonitor", { enumerable: true, get: function () { return PerformanceMonitor_2.PerformanceMonitor; } });
var ErrorHandlingService_1 = require("./ErrorHandlingService");
Object.defineProperty(exports, "ErrorHandlingService", { enumerable: true, get: function () { return ErrorHandlingService_1.ErrorHandlingService; } });
Object.defineProperty(exports, "globalErrorHandler", { enumerable: true, get: function () { return ErrorHandlingService_1.globalErrorHandler; } });
exports.globalPerformanceMonitor = new PerformanceMonitor_1.PerformanceMonitor();
//# sourceMappingURL=index.js.map