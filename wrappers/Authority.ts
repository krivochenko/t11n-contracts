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
import { generateItemContent } from './Collection';

export type AuthorityConfig = {
  ownerAddress: Address,
  mapmakerAddress: Address,
  itemPrice: bigint,
  collectionCode: Cell,
  itemCode: Cell,
};

export type Color = {
  r: number,
  g: number,
  b: number,
  a: number,
}

export type ColorSchema = {
  backgroundColor: Color,
  bordersColor: Color,
  visitedColor: Color,
  unvisitedColor: Color,
};

export type ItemContent = {
  flags: boolean[],
  colorSchema: ColorSchema,
};

export function authorityConfigToCell(config: AuthorityConfig): Cell {
  return beginCell()
    .storeAddress(config.ownerAddress)
    .storeAddress(config.mapmakerAddress)
    .storeCoins(config.itemPrice)
    .storeRef(config.collectionCode)
    .storeRef(config.itemCode)
    .endCell();
}

export class Authority implements Contract {
  constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {
  }

  static createFromAddress(address: Address) {
    return new Authority(address);
  }

  static createFromConfig(config: AuthorityConfig, code: Cell, workchain = 0) {
    const data = authorityConfigToCell(config);
    const init = { code, data };
    return new Authority(contractAddress(workchain, init), init);
  }

  async sendDeploy(provider: ContractProvider, via: Sender) {
    await provider.internal(via, {
      value: toNano('0.5'),
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell().endCell(),
    });
  }

  async sendDeployItem(provider: ContractProvider, via: Sender, ownerAddress: Address, content: ItemContent) {
    await provider.internal(via, {
      value: toNano('1.1'),
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(0x5c57d048, 32)
        .storeUint(0, 64)
        .storeAddress(ownerAddress)
        .storeRef(generateItemContent(content))
        .endCell(),
    });
  }

  async sendUpgradeItem(provider: ContractProvider, via: Sender, content: ItemContent) {
    await provider.internal(via, {
      value: toNano('0.1'),
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(0x242cc4be, 32)
        .storeUint(0, 64)
        .storeRef(generateItemContent(content))
        .endCell(),
    })
  }

  async sendSetItemPrice(provider: ContractProvider, via: Sender, itemPrice: bigint) {
    await provider.internal(via, {
      value: toNano('0.1'),
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(0x18e00496, 32)
        .storeUint(0, 64)
        .storeCoins(itemPrice)
        .endCell(),
    });

  }

  async sendWithdraw(provider: ContractProvider, via: Sender) {
    await provider.internal(via, {
      value: toNano('0.1'),
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(0x46ed2e94, 32)
        .storeUint(0, 64)
        .endCell(),
    });
  }

  async getLatestVersion(provider: ContractProvider): Promise<{ address: Address, countriesCount: number } | null> {
    const result = await provider.get('get_latest_version', []);
    const collectionData = result.stack.readCellOpt();
    if (collectionData) {
      const collectionDataSlice = collectionData.beginParse();
      return {
        address: collectionDataSlice.loadAddress(),
        countriesCount: collectionDataSlice.loadUint(10),
      };
    }
    return null;
  }

  async getItemAddressByOwnerAddress(provider: ContractProvider, owner: Address): Promise<Address> {
    const result = await provider.get('get_item_address_by_owner_address', [{ type: 'slice', cell: beginCell().storeAddress(owner).endCell() }]);
    return result.stack.readAddress();
  }

  async getItemPrice(provider: ContractProvider): Promise<bigint> {
    const result = await provider.get('get_item_price', []);
    return result.stack.readBigNumber();
  }
}
