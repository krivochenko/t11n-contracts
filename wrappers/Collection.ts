import {
  Address,
  beginCell,
  Cell,
  Contract,
  contractAddress,
  ContractProvider,
  Dictionary,
  Sender,
  SendMode,
  toNano
} from 'ton-core';

export type CircleConfig = {
  x: number,
  y: number,
  radius: number,
};

export type CollectionConfig = {
  ownerAddress: Address,
  content: Cell,
  circles: CircleConfig[],
  nftItemCode: Cell,
};

export const generateCirclesDict = (circles: CircleConfig[]) => {
  const circlesDict = Dictionary.empty(Dictionary.Keys.Uint(256), Dictionary.Values.Cell())

  for (let i = 0; i < circles.length; i++) {
    const { x, y, radius } = circles[i];
    const value = beginCell().storeUint(x, 32).storeUint(y, 32).storeUint(radius, 32).endCell();
    circlesDict.set(i, value);
  }

  return circlesDict;
}

export const generateItemContent = (colors: string[]) => {
  const content = beginCell();
  for (const color of colors) {
    content.storeStringTail(color);
  }
  return content.endCell();
};

export function collectionConfigToCell(config: CollectionConfig): Cell {
  return beginCell()
    .storeAddress(config.ownerAddress)
    .storeRef(config.content)
    .storeRef(beginCell().storeDictDirect(generateCirclesDict(config.circles)).endCell())
    .storeRef(config.nftItemCode)
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

  async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell().endCell(),
    });
  }

  async sendDeployNftItem(provider: ContractProvider, via: Sender, ownerAddress: Address, colors: string[]) {
    await provider.internal(via, {
      value: toNano('0.5'),
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(1, 32)
        .storeUint(0, 64)
        .storeAddress(ownerAddress)
        .storeRef(generateItemContent(colors))
        .endCell(),
    });
  }

  async getCollectionData(provider: ContractProvider): Promise<[bigint, Cell, Address]> {
    const result = await provider.get('get_collection_data', []);
    return [result.stack.readBigNumber(), result.stack.readCell(), result.stack.readAddress()];
  }

  async getNftIndexByOwnerAddress(provider: ContractProvider, owner: Address): Promise<bigint> {
    const result = await provider.get('get_nft_index_by_owner_address', [{ type: 'slice', cell: beginCell().storeAddress(owner).endCell() }]);
    return result.stack.readBigNumber();
  }

  async getNftContent(provider: ContractProvider, index: bigint, individualContent: Cell): Promise<Cell> {
    const result = await provider.get('get_nft_content', [{ type: 'int', value: index }, { type: 'cell', cell: individualContent }]);
    return result.stack.readCell();
  }
}
