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
import { CircleConfig, generateItemContent, generateMapDict } from './Collection';

export type AuthorityConfig = {
  ownerAddress: Address,
  collectionCode: Cell,
  itemCode: Cell,
};

export function authorityConfigToCell(config: AuthorityConfig): Cell {
  return beginCell()
    .storeAddress(config.ownerAddress)
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

  async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell().endCell(),
    });
  }

  async sendDeployCollection(provider: ContractProvider, via: Sender, metadata: Cell, map: CircleConfig[]) {
    const mapCell = beginCell().storeDictDirect(generateMapDict(map)).endCell();

    await provider.internal(via, {
      value: toNano('0.5'),
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(0x647ed24f, 32)
        .storeUint(0, 64)
        .storeRef(metadata)
        .storeRef(mapCell)
        .endCell(),
    });
  }

  async sendDeployItem(provider: ContractProvider, via: Sender, ownerAddress: Address, flags: boolean[]) {
    await provider.internal(via, {
      value: toNano('0.5'),
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(0x76f730a1, 32)
        .storeUint(0, 64)
        .storeAddress(ownerAddress)
        .storeRef(generateItemContent(flags))
        .endCell(),
    });
  }

  async sendUpgradeItem(provider: ContractProvider, via: Sender, flags: boolean[]) {
    await provider.internal(via, {
      value: toNano('0.5'),
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(0x46871692, 32)
        .storeUint(0, 64)
        .storeRef(generateItemContent(flags))
        .endCell(),
    })
  }

  async getLatestCollection(provider: ContractProvider): Promise<{ address: Address, countriesCount: number } | null> {
    const result = await provider.get('get_latest_collection', []);
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

  async getNftIndexByOwnerAddress(provider: ContractProvider, owner: Address): Promise<bigint> {
    const result = await provider.get('get_nft_index_by_owner_address', [{ type: 'slice', cell: beginCell().storeAddress(owner).endCell() }]);
    return result.stack.readBigNumber();
  }
}
