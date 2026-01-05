// src/domain/png-writer.ts
// =============================================================================
// PNG CHARACTER CARD WRITER
// Client-side PNG metadata embedding for character cards
// =============================================================================
//
// This module allows creating PNG character cards with embedded metadata
// without modifying the original character. It replicates the server-side
// logic from SillyTavern's character-card-parser.js for client-side use.
//
// =============================================================================

import extract from 'png-chunks-extract';
import text from 'png-chunk-text';
import { crc32 } from 'crc';

// =============================================================================
// TYPES
// =============================================================================

interface PngChunk {
    name: string;
    data: Uint8Array;
}

// =============================================================================
// PNG ENCODER
// =============================================================================

/**
 * Encodes PNG chunks into a PNG file format buffer.
 * Based on SillyTavern's src/png/encode.js (MIT license)
 */
function encodePng(chunks: PngChunk[]): Uint8Array {
    const uint8 = new Uint8Array(4);
    const int32 = new Int32Array(uint8.buffer);
    const uint32 = new Uint32Array(uint8.buffer);

    let totalSize = 8;
    for (const chunk of chunks) {
        totalSize += chunk.data.length + 12;
    }

    const output = new Uint8Array(totalSize);
    let idx = 8;

    // PNG signature
    output[0] = 0x89;
    output[1] = 0x50;
    output[2] = 0x4e;
    output[3] = 0x47;
    output[4] = 0x0d;
    output[5] = 0x0a;
    output[6] = 0x1a;
    output[7] = 0x0a;

    for (const { name, data } of chunks) {
        const size = data.length;
        const nameChars = new Uint8Array([
            name.charCodeAt(0),
            name.charCodeAt(1),
            name.charCodeAt(2),
            name.charCodeAt(3),
        ]);

        // Write size (big-endian)
        uint32[0] = size;
        output[idx++] = uint8[3];
        output[idx++] = uint8[2];
        output[idx++] = uint8[1];
        output[idx++] = uint8[0];

        // Write name
        output[idx++] = nameChars[0];
        output[idx++] = nameChars[1];
        output[idx++] = nameChars[2];
        output[idx++] = nameChars[3];

        // Write data
        for (let j = 0; j < size; j++) {
            output[idx++] = data[j];
        }

        // Write CRC (crc32 accepts Buffer or string, we pass as any for browser compat)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const crcValue = crc32(data as any, crc32(nameChars as any));
        int32[0] = crcValue;
        output[idx++] = uint8[3];
        output[idx++] = uint8[2];
        output[idx++] = uint8[1];
        output[idx++] = uint8[0];
    }

    return output;
}

// =============================================================================
// CHARACTER CARD WRITER
// =============================================================================

/**
 * Writes character data into a PNG image buffer.
 * Creates both v2 (chara) and v3 (ccv3) metadata chunks.
 *
 * @param imageBuffer - Original PNG image as ArrayBuffer
 * @param characterData - Character JSON object to embed
 * @returns New PNG as Blob with embedded character data
 */
export function writeCharacterPng(
    imageBuffer: ArrayBuffer,
    characterData: Record<string, unknown>,
): Blob {
    const image = new Uint8Array(imageBuffer);
    const chunks: PngChunk[] = extract(image);

    // Remove existing character data chunks
    const filteredChunks = chunks.filter((chunk: PngChunk) => {
        if (chunk.name !== 'tEXt') return true;
        const decoded = text.decode(chunk.data);
        const keyword = decoded.keyword.toLowerCase();
        return keyword !== 'chara' && keyword !== 'ccv3';
    });

    // Prepare v2 data (chara)
    const v2Json = JSON.stringify(characterData);
    const v2Base64 = btoa(unescape(encodeURIComponent(v2Json)));
    const v2Chunk = text.encode('chara', v2Base64);

    // Prepare v3 data (ccv3)
    const v3Data = {
        ...characterData,
        spec: 'chara_card_v3',
        spec_version: '3.0',
    };
    const v3Json = JSON.stringify(v3Data);
    const v3Base64 = btoa(unescape(encodeURIComponent(v3Json)));
    const v3Chunk = text.encode('ccv3', v3Base64);

    // Insert chunks before IEND (last chunk)
    filteredChunks.splice(-1, 0, v2Chunk, v3Chunk);

    // Encode and return as Blob
    const pngBuffer = encodePng(filteredChunks);
    // Use slice() to get a proper ArrayBuffer from the Uint8Array
    return new Blob([pngBuffer.slice().buffer], { type: 'image/png' });
}

/**
 * Fetches a character's avatar PNG.
 *
 * @param avatarUrl - The avatar filename (e.g., "character.png")
 * @returns PNG as ArrayBuffer, or null on error
 */
export async function fetchCharacterAvatar(
    avatarUrl: string,
): Promise<ArrayBuffer | null> {
    try {
        const response = await fetch(
            `/characters/${encodeURIComponent(avatarUrl)}`,
        );
        if (!response.ok) return null;
        return await response.arrayBuffer();
    } catch {
        return null;
    }
}

/**
 * Creates a downloadable character PNG with custom data.
 * Does NOT modify the original character.
 *
 * @param avatarUrl - The avatar filename
 * @param characterData - Modified character JSON to embed
 * @param filename - Download filename
 */
export async function downloadCharacterPng(
    avatarUrl: string,
    characterData: Record<string, unknown>,
    filename: string,
): Promise<boolean> {
    // Fetch original avatar image
    const imageBuffer = await fetchCharacterAvatar(avatarUrl);
    if (!imageBuffer) {
        return false;
    }

    try {
        // Create PNG with new character data
        const pngBlob = writeCharacterPng(imageBuffer, characterData);

        // Trigger download
        const url = URL.createObjectURL(pngBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        return true;
    } catch {
        return false;
    }
}
