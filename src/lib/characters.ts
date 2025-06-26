import alexPng from '@/assets/characters/alex/alex.png';
import alexJson from '@/assets/characters/alex/alex.json';
import anaPng from '@/assets/characters/ana/ana.png';
import anaJson from '@/assets/characters/ana/ana.json';
import ardleyPng from '@/assets/characters/ardley/ardley.png';
import ardleyJson from '@/assets/characters/ardley/ardley.json';
import coltPng from '@/assets/characters/colt/colt.png';
import coltJson from '@/assets/characters/colt/colt.json';
import esterPng from '@/assets/characters/ester/ester.png';
import esterJson from '@/assets/characters/ester/ester.json';
import tomPng from '@/assets/characters/tom/tom.png';
import tomJson from '@/assets/characters/tom/tom.json';
import type { StaticImageData } from 'next/image';

export interface Character {
    id: 'alex' | 'ana' | 'ardley' | 'colt' | 'ester' | 'tom';
    name: string;
    json: any;
    png: StaticImageData;
    previewFrame: {
        x: number;
        y: number;
        w: number;
        h: number;
    }
}

export const CHARACTERS_LIST: Character[] = [
    {
        id: 'alex',
        name: 'Alex',
        json: alexJson,
        png: alexPng,
        previewFrame: { x: 0, y: 0, w: 16, h: 32 }
    },
    {
        id: 'ana',
        name: 'Ana',
        json: anaJson,
        png: anaPng,
        previewFrame: { x: 0, y: 0, w: 16, h: 32 }
    },
    {
        id: 'ardley',
        name: 'Ardley',
        json: ardleyJson,
        png: ardleyPng,
        previewFrame: { x: 1, y: 1, w: 16, h: 23 }
    },
    {
        id: 'colt',
        name: 'Colt',
        json: coltJson,
        png: coltPng,
        previewFrame: { x: 0, y: 0, w: 16, h: 32 }
    },
    {
        id: 'ester',
        name: 'Ester',
        json: esterJson,
        png: esterPng,
        previewFrame: { x: 0, y: 0, w: 16, h: 32 }
    },
    {
        id: 'tom',
        name: 'Tom',
        json: tomJson,
        png: tomPng,
        previewFrame: { x: 0, y: 0, w: 16, h: 32 }
    }
];

export const CHARACTERS_MAP = CHARACTERS_LIST.reduce((acc, char) => {
    acc[char.id] = char;
    return acc;
}, {} as Record<string, Character>);
