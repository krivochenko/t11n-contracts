import { Blockchain, SandboxContract, TreasuryContract } from '@ton-community/sandbox';
import { beginCell, Cell, toNano } from 'ton-core';
import { Collection } from '../wrappers/Collection';
import '@ton-community/test-utils';
import { compile } from '@ton-community/blueprint';
import { buildOnChainMetadata, data } from '../helpers/metadata';
import { Item } from '../wrappers/Item';

describe('Collection', () => {
  let collectionCode: Cell;
  let itemCode: Cell;
  let deployer: SandboxContract<TreasuryContract>;

  beforeAll(async () => {
    collectionCode = await compile('Collection');
    itemCode = await compile('Item');
  });

  let blockchain: Blockchain;
  let collection: SandboxContract<Collection>;

  beforeEach(async () => {
    blockchain = await Blockchain.create();
    deployer = await blockchain.treasury('deployer');

    collection = blockchain.openContract(Collection.createFromConfig({
      ownerAddress: deployer.address,
      content: buildOnChainMetadata(data),
      nftItemCode: itemCode,
    }, collectionCode));

    const deployResult = await collection.sendDeploy(deployer.getSender(), toNano('1'));

    expect(deployResult.transactions).toHaveTransaction({
      from: deployer.address,
      to: collection.address,
      deploy: true,
      success: true,
    });
  });

  it('should deploy item', async () => {
    await collection.sendDeployNftItem(deployer.getSender(), deployer.address);

    const [nextItemIndex, collectionContent, collectionOwnerAddress] = await collection.getCollectionData();

    expect(nextItemIndex).toBe(0n);
    expect(collectionContent).toEqualCell(buildOnChainMetadata(data));
    expect(collectionOwnerAddress).toEqualAddress(deployer.address);

    const itemIndex = await collection.getNftIndexByOwnerAddress(deployer.address);

    const item = blockchain.openContract(Item.createFromConfig({ collectionAddress: collection.address, index: itemIndex }, itemCode));
    const [init, index, collectionAddress, itemOwnerAddress, content] = await item.getNftData();

    expect(init).toBe(true);
    expect(index).toBe(itemIndex);
    expect(collectionAddress).toEqualAddress(collection.address);
    expect(itemOwnerAddress).toEqualAddress(deployer.address);
    expect(content).toEqualCell(beginCell().endCell());
  });
});
