import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Dictionary } from 'ton-core';

export type CircleConfig = {
  x: number,
  y: number,
  radius: number,
};

export type CollectionConfig = {
  authorityAddress: Address,
  metadata: Cell,
  map: CircleConfig[],
  itemCode: Cell,
};

export const generateMapDict = (circles: CircleConfig[]) => {
  const circlesDict = Dictionary.empty(Dictionary.Keys.Uint(10), Dictionary.Values.Cell())

  for (let i = 0; i < circles.length; i++) {
    const { x, y, radius } = circles[i];
    const value = beginCell().storeUint(x, 12).storeUint(y, 12).storeUint(radius, 12).endCell();
    circlesDict.set(i, value);
  }

  return circlesDict;
}

export const generateItemContent = (flags: boolean[]) => {
  const content = beginCell();
  for (const flag of flags) {
    content.storeBit(flag);
  }
  return content.endCell();
};

export function collectionConfigToCell(config: CollectionConfig): Cell {
  const circlesCell = beginCell().storeDictDirect(generateMapDict(config.map)).endCell();

  return beginCell()
    .storeAddress(config.authorityAddress)
    .storeRef(config.metadata)
    .storeRef(circlesCell)
    .storeRef(config.itemCode)
    .endCell();
}

export class Collection implements Contract {
  constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {
  }

  static createFromAddress(address: Address) {
    return new Collection(address);
  }

  static createFromConfig(config: CollectionConfig, code: Cell, workchain = 0) {
    const data = collectionConfigToCell(config);
    const init = { code, data };
    return new Collection(contractAddress(workchain, init), init);
  }

  async getCollectionData(provider: ContractProvider): Promise<[bigint, Cell, Address]> {
    const result = await provider.get('get_collection_data', []);
    return [result.stack.readBigNumber(), result.stack.readCell(), result.stack.readAddress()];
  }

  async getNftContent(provider: ContractProvider, index: bigint, individualContent: Cell): Promise<Cell> {
    const result = await provider.get('get_nft_content', [{ type: 'int', value: index }, { type: 'cell', cell: individualContent }]);
    return result.stack.readCell();
  }
}
