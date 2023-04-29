import { Blockchain, SandboxContract, TreasuryContract } from '@ton-community/sandbox';
import { Cell, Dictionary } from 'ton-core';
import { Collection, generateItemContent } from '../wrappers/Collection';
import '@ton-community/test-utils';
import { compile } from '@ton-community/blueprint';
import { Item } from '../wrappers/Item';
import { Authority } from '../wrappers/Authority';
import { buildOnChainMetadata, data, parseMetadata } from '../helpers/metadata';
import { readFileSync } from 'fs';

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

    const deployResult = await authority.sendDeploy(deployer.getSender());

    expect(deployResult.transactions).toHaveTransaction({
      from: deployer.address,
      to: authority.address,
      deploy: true,
      success: true,
    });
  });

  it('should deploy collection', async () => {
    const metadata = buildOnChainMetadata(data);
    await authority.sendDeployCollection(deployer.getSender(), metadata, 'tests/files/maps/test-1.svg');
    const authorityAddress = authority.address;
    const collection = blockchain.openContract(Collection.createFromConfig({ authorityAddress, metadata, map: 'tests/files/maps/test-1.svg', itemCode }, collectionCode));

    const v1 = await authority.getLatestVersion();
    expect(v1).not.toBeNull();
    expect(v1!.address).toEqualAddress(collection.address)
    expect(v1!.countriesCount).toBe(5);

    const flags = [true, false, false, true, true];
    await authority.sendDeployItem(deployer.getSender(), deployer.address, flags);

    const [nextItemIndex, collectionContent, collectionOwnerAddress] = await collection.getCollectionData();

    expect(nextItemIndex).toBe(0n);
    expect(collectionContent).toEqualCell(buildOnChainMetadata(data));
    expect(collectionOwnerAddress).toEqualAddress(authority.address);

    const itemIndex = await authority.getNftIndexByOwnerAddress(deployer.address);
    const item = blockchain.openContract(Item.createFromConfig({ authorityAddress, index: itemIndex }, itemCode));
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
      image_data: readFileSync('tests/files/results/result-1.svg').toString('utf-8'),
    });

    const newFlags = [true, true, true, true, true];
    await item.sendEditContent(deployer.getSender(), newFlags);
    const [, , , , newContent] = await item.getNftData();

    expect(newContent).toEqualCell(generateItemContent(newFlags));
    const newNftContent = await collection.getNftContent(index, newContent);
    const newMetadataDict = newNftContent.beginParse().skip(8).loadDict(Dictionary.Keys.Buffer(32), Dictionary.Values.Cell());
    const newParsedMetadata = parseMetadata(newMetadataDict, ['name', 'description', 'image_data']);
    expect(newParsedMetadata).toEqual({
      name: 'Name',
      description: 'Description',
      image_data: readFileSync('tests/files/results/result-2.svg').toString('utf-8'),
    });

    await authority.sendDeployCollection(deployer.getSender(), metadata, 'tests/files/maps/test-2.svg');
    const v2 = await authority.getLatestVersion();
    expect(v2!.address).not.toEqualAddress(v1!.address);

    await authority.sendUpgradeItem(deployer.getSender(), [true, true, true, true]);
    const [, , collectionAddressAfterUpgrade, , contentAfterUpgrade] = await item.getNftData();
    expect(collectionAddressAfterUpgrade).toEqualAddress(v2!.address);
    expect(contentAfterUpgrade).toEqualCell(generateItemContent([true, true, true, true]));

    const collectionV2 = blockchain.openContract(Collection.createFromAddress(collectionAddressAfterUpgrade))
    const nftContentAfterUpgrade = await collectionV2.getNftContent(index, contentAfterUpgrade);
    const metadataDictAfterUpgrade = nftContentAfterUpgrade.beginParse().skip(8).loadDict(Dictionary.Keys.Buffer(32), Dictionary.Values.Cell());
    const parsedMetadataAfterUpgrade = parseMetadata(metadataDictAfterUpgrade, ['name', 'description', 'image_data']);
    expect(parsedMetadataAfterUpgrade).toEqual({
      name: 'Name',
      description: 'Description',
      image_data: readFileSync('tests/files/results/result-3.svg').toString('utf-8'),
    });
  });
});
