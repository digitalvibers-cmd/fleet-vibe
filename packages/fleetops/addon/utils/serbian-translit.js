// Serbian Latin → Cyrillic transliteration.
// Multi-letter digraphs (Lj, Nj, Dž) must be matched BEFORE single letters,
// otherwise "lj" would be split into "l" + "j" and produce wrong cyrillic output.

const DIGRAPHS = [
    ['Lj', 'Љ'],
    ['LJ', 'Љ'],
    ['lj', 'љ'],
    ['Nj', 'Њ'],
    ['NJ', 'Њ'],
    ['nj', 'њ'],
    ['Dž', 'Џ'],
    ['DŽ', 'Џ'],
    ['dž', 'џ'],
    ['Dz', 'Џ'],
    ['DZ', 'Џ'],
    ['dz', 'џ'],
    ['Dj', 'Ђ'],
    ['DJ', 'Ђ'],
    ['dj', 'ђ'],
];

const SINGLES = {
    A: 'А', a: 'а',
    B: 'Б', b: 'б',
    V: 'В', v: 'в',
    G: 'Г', g: 'г',
    D: 'Д', d: 'д',
    Đ: 'Ђ', đ: 'ђ',
    E: 'Е', e: 'е',
    Ž: 'Ж', ž: 'ж',
    Z: 'З', z: 'з',
    I: 'И', i: 'и',
    J: 'Ј', j: 'ј',
    K: 'К', k: 'к',
    L: 'Л', l: 'л',
    M: 'М', m: 'м',
    N: 'Н', n: 'н',
    O: 'О', o: 'о',
    P: 'П', p: 'п',
    R: 'Р', r: 'р',
    S: 'С', s: 'с',
    T: 'Т', t: 'т',
    Ć: 'Ћ', ć: 'ћ',
    U: 'У', u: 'у',
    F: 'Ф', f: 'ф',
    H: 'Х', h: 'х',
    C: 'Ц', c: 'ц',
    Č: 'Ч', č: 'ч',
    Š: 'Ш', š: 'ш',
};

export function latinToCyrillic(input) {
    if (!input) return input;

    let result = input;
    for (const [latin, cyrillic] of DIGRAPHS) {
        result = result.split(latin).join(cyrillic);
    }

    let out = '';
    for (const ch of result) {
        out += SINGLES[ch] ?? ch;
    }
    return out;
}

export function hasLatinChars(input) {
    return /[A-Za-zĆČĐŠŽćčđšž]/.test(input);
}
