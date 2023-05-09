import { Blockchain, SandboxContract, TreasuryContract } from '@ton-community/sandbox';
import { Cell, Dictionary, toNano } from 'ton-core';
import { Collection, generateItemContent } from '../wrappers/Collection';
import '@ton-community/test-utils';
import { compile } from '@ton-community/blueprint';
import { Item } from '../wrappers/Item';
import { Authority } from '../wrappers/Authority';
import { buildOnChainMetadata, data, parseMetadata } from '../helpers/metadata';
import { readFileSync } from 'fs';
import { mapToCell } from '../helpers/map';
import { Mapmaker } from '../wrappers/Mapmaker';

describe('Authority', () => {
  const collectionData = buildOnChainMetadata(data);

  let mapmakerCode: Cell;
  let authorityCode: Cell;
  let collectionCode: Cell;
  let itemCode: Cell;
  let deployer: SandboxContract<TreasuryContract>;

  beforeAll(async () => {
    mapmakerCode = await compile('Mapmaker');
    authorityCode = await compile('Authority');
    collectionCode = await compile('Collection');
    itemCode = await compile('Item');
  });

  let blockchain: Blockchain;
  let mapmaker: SandboxContract<Mapmaker>;
  let authority: SandboxContract<Authority>;

  beforeEach(async () => {
    blockchain = await Blockchain.create();
    deployer = await blockchain.treasury('deployer');

    mapmaker = blockchain.openContract(Mapmaker.createFromConfig({
      ownerAddress: deployer.address,
    }, mapmakerCode));

    authority = blockchain.openContract(Authority.createFromConfig({
      mapmakerAddress: mapmaker.address,
      ownerAddress: deployer.address,
      itemPrice: toNano('1.1'),
      collectionCode,
      itemCode,
    }, authorityCode));

    const mapmakerDeployResult = await mapmaker.sendDeploy(deployer.getSender());
    expect(mapmakerDeployResult.transactions).toHaveTransaction({ from: deployer.address, to: mapmaker.address, deploy: true, success: true  });

    const authorityDeployResult = await authority.sendDeploy(deployer.getSender());
    expect(authorityDeployResult.transactions).toHaveTransaction({ from: deployer.address, to: authority.address, deploy: true, success: true });
  });

  it('should return null latest version', async () => {
    const latestVersion = await authority.getLatestVersion();
    expect(latestVersion).toBeNull();
  });

  it('should deploy version and return correct data about it', async () => {
    const { map, batches } = mapToCell('tests/files/maps/test-1.svg', 2, 0);
    for (const batch of batches) {
      await mapmaker.sendFillMap(deployer.getSender(), batch);
    }
    let mapmakerMap = await mapmaker.getMap();
    expect(mapmakerMap).toEqualCell(map);

    await mapmaker.sendDeployVersion(deployer.getSender(), authority.address, collectionData);
    await mapmaker.sendResetMap(deployer.getSender());
    mapmakerMap = await mapmaker.getMap();
    expect(mapmakerMap).toBeNull();

    const collectionConfig = { authorityAddress: authority.address, collectionData, map, itemCode };
    const v1 = blockchain.openContract(Collection.createFromConfig(collectionConfig, collectionCode));

    const v1Map = await v1.getMap();
    expect(v1Map).toEqualCell(map);

    const latestVersion = await authority.getLatestVersion();
    expect(latestVersion).not.toBeNull();
    expect(latestVersion!.address).toEqualAddress(v1.address)
    expect(latestVersion!.countriesCount).toBe(5);
  });

  it('should deploy item and return correct data', async () => {
    const { map, batches } = mapToCell('tests/files/maps/test-1.svg', 2, 0);
    for (const batch of batches) {
      await mapmaker.sendFillMap(deployer.getSender(), batch);
    }
    await mapmaker.sendDeployVersion(deployer.getSender(), authority.address, collectionData);
    await mapmaker.sendResetMap(deployer.getSender());

    const collectionConfig = { authorityAddress: authority.address, collectionData, map, itemCode };
    const collection = blockchain.openContract(Collection.createFromConfig(collectionConfig, collectionCode));

    const itemContent = {
      colorSchema: {
        backgroundColor: { r: 0, g: 0, b: 0, a: 100 },
        bordersColor: { r: 255, g: 255, b: 255, a: 100 },
        visitedColor: { r: 255, g: 0, b: 0, a: 100 },
        unvisitedColor: { r: 0, g: 255, b: 0, a: 100 },
      },
      flags: [true, false, false, true, true],
    };
    await authority.sendDeployItem(deployer.getSender(), deployer.address, itemContent);

    const [nextItemIndex, collectionContent, collectionOwnerAddress] = await collection.getCollectionData();

    expect(nextItemIndex).toBe(0n);
    expect(collectionContent).toEqualCell(buildOnChainMetadata(data));
    expect(collectionOwnerAddress).toEqualAddress(authority.address);

    const itemAddress = await authority.getItemAddressByOwnerAddress(deployer.address);
    const item = blockchain.openContract(Item.createFromAddress(itemAddress));
    const [init, index, collectionAddress, itemOwnerAddress, content] = await item.getNftData();

    expect(init).toBe(true);
    expect(collectionAddress).toEqualAddress(collection.address);
    expect(itemOwnerAddress).toEqualAddress(deployer.address);
    expect(content).toEqualCell(generateItemContent(itemContent));

    const nftContent = await collection.getNftContent(index, content);
    const metadataDict = nftContent.beginParse().skip(8).loadDict(Dictionary.Keys.Buffer(32), Dictionary.Values.Cell());
    const parsedMetadata = parseMetadata(metadataDict, ['name', 'description', 'image_data']);
    expect(parsedMetadata).toEqual({
      name: '3 countries visited',
      description: 'For mint or update your map, please open @t11n_bot Telegram bot',
      image_data: readFileSync('tests/files/results/result-1.svg').toString('utf-8'),
    });
  });

  it('should edit item', async () => {
    const { map, batches } = mapToCell('tests/files/maps/test-1.svg', 2, 0);
    for (const batch of batches) {
      await mapmaker.sendFillMap(deployer.getSender(), batch);
    }
    await mapmaker.sendDeployVersion(deployer.getSender(), authority.address, collectionData);
    await mapmaker.sendResetMap(deployer.getSender());

    const collectionConfig = { authorityAddress: authority.address, collectionData, map, itemCode };
    const collection = blockchain.openContract(Collection.createFromConfig(collectionConfig, collectionCode));

    const itemContent = {
      colorSchema: {
        backgroundColor: { r: 0, g: 0, b: 0, a: 100 },
        bordersColor: { r: 255, g: 255, b: 255, a: 100 },
        visitedColor: { r: 255, g: 0, b: 0, a: 100 },
        unvisitedColor: { r: 0, g: 255, b: 0, a: 100 },
      },
      flags: [true, false, false, true, true],
    };
    await authority.sendDeployItem(deployer.getSender(), deployer.address, itemContent);

    const itemAddress = await authority.getItemAddressByOwnerAddress(deployer.address);
    const item = blockchain.openContract(Item.createFromAddress(itemAddress));

    const newItemContent = {
      colorSchema: {
        backgroundColor: { r: 0, g: 0, b: 0, a: 100 },
        bordersColor: { r: 255, g: 255, b: 255, a: 100 },
        visitedColor: { r: 255, g: 0, b: 0, a: 100 },
        unvisitedColor: { r: 0, g: 255, b: 0, a: 100 },
      },
      flags: [true, true, true, true, true],
    };
    await item.sendEditContent(deployer.getSender(), newItemContent);
    const [, index, , , newContent] = await item.getNftData();

    expect(newContent).toEqualCell(generateItemContent(newItemContent));
    const newNftContent = await collection.getNftContent(index, newContent);
    const newMetadataDict = newNftContent.beginParse().skip(8).loadDict(Dictionary.Keys.Buffer(32), Dictionary.Values.Cell());
    const newParsedMetadata = parseMetadata(newMetadataDict, ['name', 'description', 'image_data']);
    expect(newParsedMetadata).toEqual({
      name: '5 countries visited',
      description: 'For mint or update your map, please open @t11n_bot Telegram bot',
      image_data: readFileSync('tests/files/results/result-2.svg').toString('utf-8'),
    });
  });

  it('should upgrade item', async () => {
    const { batches: v1Batches } = mapToCell('tests/files/maps/test-1.svg', 2, 0);
    for (const batch of v1Batches) {
      await mapmaker.sendFillMap(deployer.getSender(), batch);
    }
    await mapmaker.sendDeployVersion(deployer.getSender(), authority.address, collectionData);
    await mapmaker.sendResetMap(deployer.getSender());

    const itemContent = {
      colorSchema: {
        backgroundColor: { r: 0, g: 0, b: 0, a: 100 },
        bordersColor: { r: 255, g: 255, b: 255, a: 100 },
        visitedColor: { r: 255, g: 0, b: 0, a: 100 },
        unvisitedColor: { r: 0, g: 255, b: 0, a: 100 },
      },
      flags: [true, false, false, true, true],
    };
    await authority.sendDeployItem(deployer.getSender(), deployer.address, itemContent);

    const itemAddress = await authority.getItemAddressByOwnerAddress(deployer.address);
    const item = blockchain.openContract(Item.createFromAddress(itemAddress));

    const { map: v2Map, batches: v2Batches } = mapToCell('tests/files/maps/test-2.svg', 2, 0);
    for (const batch of v1Batches) {
      await mapmaker.sendFillMap(deployer.getSender(), batch);
    }
    await mapmaker.sendDeployVersion(deployer.getSender(), authority.address, collectionData);
    await mapmaker.sendResetMap(deployer.getSender());

    const v2Config = { authorityAddress: authority.address, collectionData, map: v2Map, itemCode };
    const v2 = blockchain.openContract(Collection.createFromConfig(v2Config, collectionCode));

    for (const batch of v2Batches) {
      await mapmaker.sendFillMap(deployer.getSender(), batch);
    }
    await mapmaker.sendDeployVersion(deployer.getSender(), authority.address, collectionData);
    await mapmaker.sendResetMap(deployer.getSender());

    const latestVersion = await authority.getLatestVersion();
    expect(latestVersion!.address).toEqualAddress(v2.address);

    await authority.sendUpgradeItem(deployer.getSender(), itemContent);
    const [, index, collectionAddress, , content] = await item.getNftData();
    expect(collectionAddress).toEqualAddress(latestVersion!.address);
    expect(content).toEqualCell(generateItemContent(itemContent));

    const nftContentAfterUpgrade = await v2.getNftContent(index, content);
    const metadataDictAfterUpgrade = nftContentAfterUpgrade.beginParse().skip(8).loadDict(Dictionary.Keys.Buffer(32), Dictionary.Values.Cell());
    const parsedMetadataAfterUpgrade = parseMetadata(metadataDictAfterUpgrade, ['name', 'description', 'image_data']);
    expect(parsedMetadataAfterUpgrade).toEqual({
      name: '3 countries visited',
      description: 'For mint or update your map, please open @t11n_bot Telegram bot',
      image_data: readFileSync('tests/files/results/result-3.svg').toString('utf-8'),
    });
  });

  it('should set item price', async () => {
    const initialPrice = await authority.getItemPrice();
    expect(initialPrice).toBe(toNano('1.1'));

    await authority.sendSetItemPrice(deployer.getSender(), toNano('2'));

    const updatedPrice = await authority.getItemPrice();
    expect(updatedPrice).toBe(toNano('2'));
  });

  it('should withdraw', async () => {
    const ownerInitialBalance = await deployer.getBalance();

    await authority.sendWithdraw(deployer.getSender());

    const ownerUpdatedBalance = await deployer.getBalance();

    expect(ownerUpdatedBalance).toBeGreaterThan(ownerInitialBalance);
  });
});
