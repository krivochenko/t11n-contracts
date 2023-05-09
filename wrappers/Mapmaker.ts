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

export type MapmakerConfig = {
  ownerAddress: Address,
};

export function mapmakerConfigToCell(config: MapmakerConfig): Cell {
  return beginCell()
    .storeAddress(config.ownerAddress)
    .storeDict()
    .endCell();
}

export class Mapmaker implements Contract {
  constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {
  }

  static createFromAddress(address: Address) {
    return new Mapmaker(address);
  }

  static createFromConfig(config: MapmakerConfig, code: Cell, workchain = 0) {
    const data = mapmakerConfigToCell(config);
    const init = { code, data };
    return new Mapmaker(contractAddress(workchain, init), init);
  }

  async sendDeploy(provider: ContractProvider, via: Sender) {
    await provider.internal(via, {
      value: toNano('0.5'),
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell().endCell(),
    });
  }

  async sendFillMap(provider: ContractProvider, via: Sender, batch: Cell) {
    await provider.internal(via, {
      value: toNano('1.5'),
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(0x3d31429b, 32)
        .storeUint(0, 64)
        .storeRef(batch)
        .endCell(),
    });
  }

  async sendDeployVersion(provider: ContractProvider, via: Sender, authorityAddress: Address, collectionContent: Cell) {
    await provider.internal(via, {
      value: toNano('1.5'),
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(0x2e855f74, 32)
        .storeUint(0, 64)
        .storeAddress(authorityAddress)
        .storeRef(collectionContent)
        .endCell(),
    });
  }

  async sendResetMap(provider: ContractProvider, via: Sender) {
    await provider.internal(via, {
      value: toNano('0.1'),
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(0x2436922d, 32)
        .storeUint(0, 64)
        .endCell(),
    });
  }

  async getMap(provider: ContractProvider): Promise<[Cell | null, bigint]> {
    const result = await provider.get('get_map', []);
    return [result.stack.readCellOpt(), result.stack.readBigNumber()];
  }
}
