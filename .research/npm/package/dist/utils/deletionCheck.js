"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeletionNotPermittedError = void 0;
exports.parseDeletionCheck = parseDeletionCheck;
exports.assertDeletable = assertDeletable;
/** Raised when ADT answers that an object may not be deleted. */
class DeletionNotPermittedError extends Error {
    verdict;
    objectName;
    constructor(objectName, verdict) {
        const detail = verdict.message?.trim()
            ? verdict.message.trim()
            : `${verdict.externalStrongReferences} strong and ${verdict.externalWeakReferences} weak external references`;
        super(`ADT refuses to delete ${objectName}: ${detail}`);
        this.name = 'DeletionNotPermittedError';
        this.objectName = objectName;
        this.verdict = verdict;
    }
}
exports.DeletionNotPermittedError = DeletionNotPermittedError;
/**
 * Read the verdict out of a deletion-check response.
 *
 * Attribute names are matched with and without the `del:` prefix: the payload
 * is namespaced, but not every parser configuration keeps the prefix, and one
 * module in this package was already reading both spellings.
 */
function parseDeletionCheck(responseData) {
    const xml = typeof responseData === 'string' ? responseData : '';
    const attr = (name) => new RegExp(`(?:del:)?${name}="([^"]*)"`).exec(xml)?.[1];
    const number = (name) => {
        const raw = attr(name);
        const parsed = raw === undefined ? Number.NaN : Number(raw);
        return Number.isFinite(parsed) ? parsed : 0;
    };
    const text = /<del:text>([\s\S]*?)<\/del:text>/.exec(xml)?.[1];
    return {
        // Taken from the response rather than passed in: the payload already
        // names the object, and threading a label through two dozen call sites
        // would be inventing work for something the server states.
        objectName: /adtcore:name="([^"]*)"/.exec(xml)?.[1] ?? '(unnamed object)',
        // Absent means "not stated", and a deletion the server never approved is
        // not one to assume: default to refusing rather than to proceeding.
        isDeletable: attr('isDeletable') === 'true',
        externalStrongReferences: number('externalStrongReferences'),
        externalWeakReferences: number('externalWeakReferences'),
        message: text?.trim() || undefined,
        messageType: /<del:message[^>]*(?:del:)?type="([^"]*)"/.exec(xml)?.[1],
    };
}
/**
 * Throw unless ADT approved the deletion.
 *
 * Deliberately a hard failure rather than a returned flag: a caller that asked
 * for a delete and got a resolved promise is entitled to believe the object is
 * gone.
 *
 * Refusal is `isDeletable="false"`, or a message of type `E`. A `W` is a
 * warning and passes — it is reported through the returned verdict so a caller
 * can act on it, but blocking on one would be inventing a prohibition the
 * server did not state.
 */
function assertDeletable(responseData) {
    const verdict = parseDeletionCheck(responseData);
    const refused = !verdict.isDeletable || verdict.messageType?.toUpperCase() === 'E';
    if (refused) {
        throw new DeletionNotPermittedError(verdict.objectName, verdict);
    }
    return verdict;
}
