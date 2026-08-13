"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.beginCriticalSection = beginCriticalSection;
function supportsCriticalSection(connection) {
    const candidate = connection;
    return (typeof candidate?.beginCriticalSection === 'function' &&
        typeof candidate?.endCriticalSection === 'function');
}
/**
 * Open the connection's critical section and return a function that closes it.
 *
 * A disposer rather than a `withCriticalSection(fn)` wrapper on purpose: the
 * wrapper form puts the handler body inside an arrow function, and TypeScript
 * drops the narrowing done by the guard clauses above it. Every handler would
 * then need its narrowed values re-captured, which is a lot of churn to buy
 * nothing. This form leaves the body untouched:
 *
 * ```ts
 * const endCriticalSection = beginCriticalSection(this.connection);
 * try {
 *   // lock … update … unlock, unchanged
 * } finally {
 *   endCriticalSection();
 * }
 * ```
 *
 * Calling the disposer twice is harmless; it closes once. That matters because
 * the connector counts nesting, and an unbalanced count would silently extend
 * the protection over every later request on the connection.
 */
function beginCriticalSection(connection) {
    if (!supportsCriticalSection(connection)) {
        return () => { };
    }
    connection.beginCriticalSection();
    let closed = false;
    return () => {
        if (closed)
            return;
        closed = true;
        connection.endCriticalSection();
    };
}
