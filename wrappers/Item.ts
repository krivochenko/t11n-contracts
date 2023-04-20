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

export type ItemConfig = {
  index: number,
  collectionAddress: Address,
};

export function itemConfigToCell(config: ItemConfig): Cell {
  return beginCell()
    .storeUint(config.index, 64)
    .storeAddress(config.collectionAddress)
    .endCell();
}

export class Item implements Contract {
  constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {
  }

  static createFromAddress(address: Address) {
    return new Item(address);
  }

  static createFromConfig(config: ItemConfig, code: Cell, workchain = 0) {
    const data = itemConfigToCell(config);
    const init = { code, data };
    return new Item(contractAddress(workchain, init), init);
  }

  async sendTransfer(provider: ContractProvider, via: Sender, value: bigint) {
    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(0x5fcc3d14, 32)
        .storeUint(0, 64)

        .storeAddress(via.address)
        .storeUint(0x00, 2)
        .storeMaybeRef()
        .storeCoins(toNano('0.001'))
        .storeUint(0, 32)
        .storeStringTail('nft')

        .endCell(),
    })

  }


  async getNftData(provider: ContractProvider): Promise<[boolean, bigint, Address, Address, Cell]> {
    const result = await provider.get('get_nft_data', []);
    return [result.stack.readBoolean(), result.stack.readBigNumber(), result.stack.readAddress(), result.stack.readAddress(), result.stack.readCell()];
  }
}
