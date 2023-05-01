import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider } from 'ton-core';
import { mapToCell } from '../helpers/map';
import { ItemContent } from './Authority';

export type CollectionConfig = {
  authorityAddress: Address,
  collectionData: Cell,
  map: string,
  itemCode: Cell,
};

export const generateItemContent = (content: ItemContent) => {
  const { backgroundColor, bordersColor, visitedColor, unvisitedColor, flags } = content;
  const builder = beginCell().storeStringTail(backgroundColor).storeStringTail(bordersColor).storeStringTail(visitedColor).storeStringTail(unvisitedColor);
  for (const flag of flags) {
    builder.storeBit(flag);
  }
  return builder.endCell();
};

export function collectionConfigToCell(config: CollectionConfig): Cell {
  return beginCell()
    .storeAddress(config.authorityAddress)
    .storeRef(config.collectionData)
    .storeRef(mapToCell(config.map))
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
