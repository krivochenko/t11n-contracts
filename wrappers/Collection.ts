import {
  Address,
  beginCell,
  Cell,
  Contract,
  contractAddress,
  ContractProvider,
  Sender,
  SendMode,
  toNano
} from 'ton-core';
import { ItemContent } from './Authority';

export type CollectionConfig = {
  authorityAddress: Address,
  ownerAddress: Address,
  collectionData: Cell,
  mapHash: Buffer,
  itemCode: Cell,
};

export const generateItemContent = (content: ItemContent) => {
  const { colorSchema, flags } = content;
  const { backgroundColor, bordersColor, visitedColor, unvisitedColor } = colorSchema;
  const builder = beginCell()
    .storeUint(backgroundColor.r, 8).storeUint(backgroundColor.g, 8).storeUint(backgroundColor.b, 8).storeUint(backgroundColor.a, 7)
    .storeUint(bordersColor.r, 8).storeUint(bordersColor.g, 8).storeUint(bordersColor.b, 8).storeUint(bordersColor.a, 7)
    .storeUint(visitedColor.r, 8).storeUint(visitedColor.g, 8).storeUint(visitedColor.b, 8).storeUint(visitedColor.a, 7)
    .storeUint(unvisitedColor.r, 8).storeUint(unvisitedColor.g, 8).storeUint(unvisitedColor.b, 8).storeUint(unvisitedColor.a, 7);
  for (const flag of flags) {
    builder.storeBit(flag);
  }
  return builder.endCell();
};

export function collectionConfigToCell(config: CollectionConfig): Cell {
  return beginCell()
    .storeAddress(config.authorityAddress)
    .storeAddress(config.ownerAddress)
    .storeBuffer(config.mapHash)
    .storeRef(config.collectionData)
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

  async sendFillVersion(provider: ContractProvider, via: Sender, batch: Cell) {
    await provider.internal(via, {
      value: toNano('0.1'),
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(0x2e7034db, 32)
        .storeUint(0, 64)
        .storeRef(batch)
        .endCell(),
    });
  }

  async sendReleaseVersion(provider: ContractProvider, via: Sender) {
    await provider.internal(via, {
      value: toNano('0.1'),
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(0x40b14775, 32)
        .storeUint(0, 64)
        .endCell(),
    });
  }

  async getCollectionData(provider: ContractProvider): Promise<[bigint, Cell, Address]> {
    const result = await provider.get('get_collection_data', []);
    return [result.stack.readBigNumber(), result.stack.readCell(), result.stack.readAddress()];
  }

  async getNftContent(provider: ContractProvider, index: bigint, individualContent: Cell): Promise<Cell> {
    const result = await provider.get('get_nft_content', [{ type: 'int', value: index }, { type: 'cell', cell: individualContent }]);
    return result.stack.readCell();
  }

  async getMap(provider: ContractProvider): Promise<Cell> {
    const result = await provider.get('get_map', []);
    return result.stack.readCell();
  }
}
