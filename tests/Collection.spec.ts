import { Blockchain, SandboxContract, TreasuryContract } from '@ton-community/sandbox';
import { Cell, Dictionary, toNano } from 'ton-core';
import { CircleConfig, Collection, generateItemContent } from '../wrappers/Collection';
import '@ton-community/test-utils';
import { compile } from '@ton-community/blueprint';
import { buildOnChainMetadata, data, parseMetadata } from '../helpers/metadata';
import { Item } from '../wrappers/Item';

const circles: CircleConfig[] = [
  { x: 60, y: 50, radius: 20 },
  { x: 40, y: 50, radius: 20 },
];

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
      circles,
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
    const colors = ['ff0000', '00ff00'];
    await collection.sendDeployNftItem(deployer.getSender(), deployer.address, colors);

    const [nextItemIndex, collectionContent, collectionOwnerAddress] = await collection.getCollectionData();

    expect(nextItemIndex).toBe(0n);
    expect(collectionContent).toEqualCell(buildOnChainMetadata(data));
    expect(collectionOwnerAddress).toEqualAddress(deployer.address);

    const itemIndex = await collection.getNftIndexByOwnerAddress(deployer.address);
    const item = blockchain.openContract(Item.createFromConfig({
      collectionAddress: collection.address,
      index: itemIndex
    }, itemCode));
    const [init, index, collectionAddress, itemOwnerAddress, content] = await item.getNftData();

    expect(init).toBe(true);
    expect(index).toBe(itemIndex);
    expect(collectionAddress).toEqualAddress(collection.address);
    expect(itemOwnerAddress).toEqualAddress(deployer.address);
    expect(content).toEqualCell(generateItemContent(colors));

    const nftContent = await collection.getNftContent(index, content);
    const metadataDict = nftContent.beginParse().skip(8).loadDict(Dictionary.Keys.Buffer(32), Dictionary.Values.Cell());
    const parsedMetadata = parseMetadata(metadataDict, ['name', 'description', 'image_data']);
    expect(parsedMetadata).toEqual({
      name: 'Name',
      description: 'Description',
      image_data: '<svg viewBox=\'0 0 100 100\' xmlns=\'http://www.w3.org/2000/svg\'><circle fill=\'#ff0000\' cx=\'60\' cy=\'50\' r=\'20\' /><circle fill=\'#00ff00\' cx=\'40\' cy=\'50\' r=\'20\' /></svg>'
    });

    const newColors = ['ff0000', '00ff00'];
    await item.sendEditContent(deployer.getSender(), newColors);
    const [, , , , newContent] = await item.getNftData();

    expect(newContent).toEqualCell(generateItemContent(newColors));
    const newNftContent = await collection.getNftContent(index, newContent);
    const newMetadataDict = newNftContent.beginParse().skip(8).loadDict(Dictionary.Keys.Buffer(32), Dictionary.Values.Cell());
    const newParsedMetadata = parseMetadata(newMetadataDict, ['name', 'description', 'image_data']);
    expect(newParsedMetadata).toEqual({
      name: 'Name',
      description: 'Description',
      image_data: '<svg viewBox=\'0 0 100 100\' xmlns=\'http://www.w3.org/2000/svg\'><circle fill=\'#ff0000\' cx=\'60\' cy=\'50\' r=\'20\' /><circle fill=\'#00ff00\' cx=\'40\' cy=\'50\' r=\'20\' /></svg>'
    });
  });
});
