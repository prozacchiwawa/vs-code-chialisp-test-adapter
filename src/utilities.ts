// Thanks: https://github.com/kondratyev-nv/vscode-python-test-adapter/blob/master/src/utilities/fs.ts
// MIT license
import * as fs from 'fs';
import { stringify } from 'querystring';

export function isFileExists(file: fs.PathLike): Promise<boolean> {
    return new Promise<boolean>((resolve, _) => {
        fs.exists(file, exist => {
            resolve(exist);
        });
    });
}

export function readFile(file: fs.PathLike): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        fs.readFile(file, 'utf-8', (error, content) => {
            if (error) {
                reject(error);
            }

            resolve(content);
        });
    });
}

export function countSpaces(l : string) : number {
    let i = 0;
    while (i < l.length && l[i] === ' ') { i++; }
    return i;
}

const specRegex = /.*<([MFC][^ ]+) ([^ ]+)>/;

export type RawLine = {
    indt: number;
    kind: string;
    name: string;
};

export function captureTestLine(line : string) : (RawLine | null) {
    const indent = countSpaces(line);
    let modResult = line.match(specRegex);
    if (modResult) {
        return { indt: indent, kind: modResult[1], name: modResult[2] };
    }
    return null;
}