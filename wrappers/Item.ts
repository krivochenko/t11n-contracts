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

export type ItemConfig = {
  index: bigint,
  authorityAddress: Address,
};

export function itemConfigToCell(config: ItemConfig): Cell {
  return beginCell()
    .storeUint(config.index, 256)
    .storeAddress(config.authorityAddress)
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

  async sendEditContent(provider: ContractProvider, via: Sender, flags: boolean[]) {
    await provider.internal(via, {
      value: toNano('0.1'),
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(0x1a0b9d51, 32)
        .storeUint(0, 64)
        .storeRef(generateItemContent(flags))
        .endCell(),
    });
  }

  async getNftData(provider: ContractProvider): Promise<[boolean, bigint, Address, Address, Cell]> {
    const result = await provider.get('get_nft_data', []);
    return [result.stack.readBoolean(), result.stack.readBigNumber(), result.stack.readAddress(), result.stack.readAddress(), result.stack.readCell()];
  }
}
