import { Blockchain, SandboxContract, TreasuryContract } from '@ton-community/sandbox';
import { Cell, Dictionary, toNano } from 'ton-core';
import { CircleConfig, Collection, generateItemContent } from '../wrappers/Collection';
import '@ton-community/test-utils';
import { compile } from '@ton-community/blueprint';
import { Item } from '../wrappers/Item';
import { Authority } from '../wrappers/Authority';
import { buildOnChainMetadata, data, parseMetadata } from '../helpers/metadata';

const map: CircleConfig[] = [
  { x: 60, y: 50, radius: 20 },
  { x: 40, y: 50, radius: 20 },
];

describe('Authority', () => {
  let authorityCode: Cell;
  let collectionCode: Cell;
  let itemCode: Cell;
  let deployer: SandboxContract<TreasuryContract>;

  beforeAll(async () => {
    authorityCode = await compile('Authority');
    collectionCode = await compile('Collection');
    itemCode = await compile('Item');
  });

  let blockchain: Blockchain;
  let authority: SandboxContract<Authority>;

  beforeEach(async () => {
    blockchain = await Blockchain.create();
    deployer = await blockchain.treasury('deployer');

    authority = blockchain.openContract(Authority.createFromConfig({
      ownerAddress: deployer.address,
      collectionCode,
      itemCode,
    }, authorityCode));

    const deployResult = await authority.sendDeploy(deployer.getSender(), toNano('1'));

    expect(deployResult.transactions).toHaveTransaction({
      from: deployer.address,
      to: authority.address,
      deploy: true,
      success: true,
    });
  });

  it('should deploy collection', async () => {
    const metadata = buildOnChainMetadata(data);
    await authority.sendDeployCollection(deployer.getSender(), metadata, map);

    const collection = blockchain.openContract(Collection.createFromConfig({
      authorityAddress: authority.address,
      metadata,
      map,
      itemCode: itemCode,
    }, collectionCode));

    const v1 = await authority.getLatestCollection();
    expect(v1).not.toBeNull();
    expect(v1!.address).toEqualAddress(collection.address)
    expect(v1!.countriesCount).toBe(2);

    const flags = [true, false];
    await authority.sendDeployItem(deployer.getSender(), deployer.address, flags);

    const [nextItemIndex, collectionContent, collectionOwnerAddress] = await collection.getCollectionData();

    expect(nextItemIndex).toBe(0n);
    expect(collectionContent).toEqualCell(buildOnChainMetadata(data));
    expect(collectionOwnerAddress).toEqualAddress(authority.address);

    const itemIndex = await authority.getNftIndexByOwnerAddress(deployer.address);
    const item = blockchain.openContract(Item.createFromConfig({
      authorityAddress: authority.address,
      index: itemIndex
    }, itemCode));
    const [init, index, collectionAddress, itemOwnerAddress, content] = await item.getNftData();

    expect(init).toBe(true);
    expect(index).toBe(itemIndex);
    expect(collectionAddress).toEqualAddress(collection.address);
    expect(itemOwnerAddress).toEqualAddress(deployer.address);
    expect(content).toEqualCell(generateItemContent(flags));

    const nftContent = await collection.getNftContent(index, content);
    const metadataDict = nftContent.beginParse().skip(8).loadDict(Dictionary.Keys.Buffer(32), Dictionary.Values.Cell());
    const parsedMetadata = parseMetadata(metadataDict, ['name', 'description', 'image_data']);
    expect(parsedMetadata).toEqual({
      name: 'Name',
      description: 'Description',
      image_data: '<svg viewBox=\'0 0 100 100\' xmlns=\'http://www.w3.org/2000/svg\'><circle fill=\'#000000\' cx=\'60\' cy=\'50\' r=\'20\' /><circle fill=\'#ffffff\' cx=\'40\' cy=\'50\' r=\'20\' /></svg>'
    });

    const newFlags = [false, true];
    await item.sendEditContent(deployer.getSender(), newFlags);
    const [, , , , newContent] = await item.getNftData();

    expect(newContent).toEqualCell(generateItemContent(newFlags));
    const newNftContent = await collection.getNftContent(index, newContent);
    const newMetadataDict = newNftContent.beginParse().skip(8).loadDict(Dictionary.Keys.Buffer(32), Dictionary.Values.Cell());
    const newParsedMetadata = parseMetadata(newMetadataDict, ['name', 'description', 'image_data']);
    expect(newParsedMetadata).toEqual({
      name: 'Name',
      description: 'Description',
      image_data: '<svg viewBox=\'0 0 100 100\' xmlns=\'http://www.w3.org/2000/svg\'><circle fill=\'#ffffff\' cx=\'60\' cy=\'50\' r=\'20\' /><circle fill=\'#000000\' cx=\'40\' cy=\'50\' r=\'20\' /></svg>'
    });

    const revertedCircles = [...map].reverse();
    await authority.sendDeployCollection(deployer.getSender(), metadata, revertedCircles);
    const v2 = await authority.getLatestCollection();
    expect(v2!.address).not.toEqualAddress(v1!.address);
  });
});
