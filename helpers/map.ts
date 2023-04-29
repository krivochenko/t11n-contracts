import { ElementNode, parse } from 'svg-parser';
import { readFileSync } from 'fs';
import { beginCell, Cell, Dictionary } from 'ton-core';
import { snake } from './metadata';

export const mapToCell = (file: string): Cell => {
  const imageData = readFileSync(file).toString('utf-8');
  const root = parse(imageData);
  const svg = root.children;
  const paths = (svg[0] as ElementNode).children as ElementNode[];

  const countries = paths.reduce<{[key: string]: string[]}>((result, path) => {
    if (!path.properties) {
      return result;
    }
    const name = path.properties.name || path.properties.class;
    if (!name) {
      return result;
    }
    const d = path.properties.d as string;
    if (!!d) {
      result[name] = result[name] ? [...result[name], d] : [d];
    }
    return result;
  }, {});

  const dict = Dictionary.empty(
    Dictionary.Keys.Buffer(32),
    Dictionary.Values.Dictionary(Dictionary.Keys.Uint(10), Dictionary.Values.Cell()),
  );
  const countriesNames = Object.keys(countries);

  for (let c = 0; c < countriesNames.length; c++) {
    const countryName = countriesNames[c];
    const countryNameBuffer = Buffer.alloc(32);
    countryNameBuffer.write(countriesNames[c]);

    const countryDict = Dictionary.empty(Dictionary.Keys.Uint(10), Dictionary.Values.Cell());
    const countryPaths = countries[countryName];

    for (let i = 0; i < countryPaths.length; i++) {
      const buffer = Buffer.from(countryPaths[i], 'utf8');
      const builder = beginCell();
      countryDict.set(i, snake(buffer, builder))
    }

    dict.set(countryNameBuffer, countryDict);
  }

  return beginCell().storeDictDirect(dict).endCell();
}
