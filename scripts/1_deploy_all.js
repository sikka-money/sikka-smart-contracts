let hre = require("hardhat");
let {ethers, upgrades} = require("hardhat");
const {BN, ether} = require("@openzeppelin/test-helpers");
const fs = require("fs");
const { poll } = require("ethers/lib/utils");

let wad = "000000000000000000", // 18 Decimals
    ray = "000000000000000000000000000", // 27 Decimals
    rad = "000000000000000000000000000000000000000000000", // 45 Decimals
    ONE = 10 ** 27;

async function main() {

    // Signer
    [deployer] = await ethers.getSigners();
        
    // External Addresses
    let { _aMATICc, _wMatic, _dex, _dexPairFee, _chainId, _maxDepositFee, 
    _maxWithdrawalFee, _maxStrategies, _cerosStrategyAllocatoin, _waitingPoolCap, _mat, 
    _ikkaRewardsPoolLimitInEth, _ikkaTokenRewardsSupplyinEth, _ikkaOracleInitialPriceInWei, 
    _rewardsRate, _vat_Line, _vat_line, _vat_dust, _spot_par, _jug_base, _dog_Hole, _dog_hole,
    _dog_chop, _abacus_tau, _clip_buf, _clip_tail, _clip_cusp, _clip_chip, _clip_tip, _clip_stopped, _whitelistOperator, _multisig} = require(`./${hre.network.name}_config.json`);

    let _ilkCeMatic = ethers.utils.formatBytes32String("ceMATIC");
    let ceaMATICc, ceVault, sMatic, cerosRouter;

    // Contracts Fetching
    this.CeaMATICc = await hre.ethers.getContractFactory("CeToken");
    this.CeVault = await hre.ethers.getContractFactory("CeVault");
    this.AMATICb = await hre.ethers.getContractFactory("aMATICb");
    this.AMATICc = await hre.ethers.getContractFactory("aMATICc");
    this.SMatic = await hre.ethers.getContractFactory("sMATIC");
    this.CerosRouter = await hre.ethers.getContractFactory("CerosRouter");
    this.SikkaProvider = await hre.ethers.getContractFactory("SikkaProvider");

    this.Vat = await hre.ethers.getContractFactory("Vat");
    this.Spot = await hre.ethers.getContractFactory("Spotter");
    this.Sikka = await hre.ethers.getContractFactory("Sikka");
    this.GemJoin = await hre.ethers.getContractFactory("GemJoin");
    this.SikkaJoin = await hre.ethers.getContractFactory("SikkaJoin");
    this.Oracle = await hre.ethers.getContractFactory("MaticOracle"); 
    this.Jug = await hre.ethers.getContractFactory("Jug");
    this.Vow = await hre.ethers.getContractFactory("Vow");
    this.Dog = await hre.ethers.getContractFactory("Dog");
    this.Clip = await hre.ethers.getContractFactory("Clipper");
    this.Abacus = await hre.ethers.getContractFactory("LinearDecrease");

    this.IkkaToken = await hre.ethers.getContractFactory("IkkaToken");
    this.IkkaRewards = await hre.ethers.getContractFactory("IkkaRewards");
    this.IkkaOracle = await hre.ethers.getContractFactory("IkkaOracle"); 
    
    this.AuctionProxy = await hre.ethers.getContractFactory("AuctionProxy");

    const auctionProxy = await this.AuctionProxy.deploy();
    await auctionProxy.deployed();
    this.Interaction = await hre.ethers.getContractFactory("Interaction", {
        unsafeAllow: ['external-library-linking'],
        libraries: {
            AuctionProxy: auctionProxy.address
        }
    });

    this.MasterVault = await hre.ethers.getContractFactory("MasterVault");
    this.WaitingPool = await hre.ethers.getContractFactory("WaitingPool");
    this.CerosYieldConverterStrategy = await hre.ethers.getContractFactory("CerosYieldConverterStrategy");

    this.PriceGetter = await hre.ethers.getContractFactory("PriceGetter");

    this.SwapPool = await ethers.getContractFactory("SwapPool");
    this.LP = await ethers.getContractFactory("LP");

    // PriceGetter Deployment
    console.log("PriceGetter...")
    
    let { _dexFactory } = require(`./${hre.network.name}_config.json`);    
    let priceGetter = await this.PriceGetter.deploy(_dexFactory);
    await priceGetter.deployed();
    console.log("PriceGetter     : " + priceGetter.address);

    // SwapPool Deployment
    console.log("SwapPool...");

    let { _swapPoolManager , _swapPool_stakeFee, _swapPool_unstakeFee , _maticPool } = require(`./${hre.network.name}_config.json`);
    let lp = await upgrades.deployProxy(this.LP, ["aMATICcLP", "aMATICcLP"], {initializer: "initialize"});
    await lp.deployed();
    let lpImplementation = await upgrades.erc1967.getImplementationAddress(lp.address);
    console.log("lp              : " + lp.address);
    console.log("imp             : " + lpImplementation);

    let swapPool = await upgrades.deployProxy(this.SwapPool, [_wMatic, _aMATICc, lp.address, false, false], {initializer: "initialize"});
    await swapPool.deployed();
    let swapPoolImplementation = await upgrades.erc1967.getImplementationAddress(swapPool.address);
    console.log("swapPool        : " + swapPool.address);
    console.log("imp             : " + swapPoolImplementation);

    // Ceros Deployment
    console.log("Ceros...");

    ceaMATICc = await upgrades.deployProxy(this.CeaMATICc, ["CEROS aMATICc Vault Token", "ceaMATICc"], {initializer: "initialize"});
    await ceaMATICc.deployed();
    ceaMATICcImp = await upgrades.erc1967.getImplementationAddress(ceaMATICc.address);
    console.log("ceaMATICc       : " + ceaMATICc.address);
    console.log("imp             : " + ceaMATICcImp);

    ceVault = await upgrades.deployProxy(this.CeVault, ["CEROS aMATICc Vault", ceaMATICc.address, _aMATICc], {initializer: "initialize"});
    await ceVault.deployed();
    ceVaultImp = await upgrades.erc1967.getImplementationAddress(ceVault.address);
    console.log("ceVault         : " + ceVault.address);
    console.log("imp             : " + ceVaultImp);

    sMatic = await upgrades.deployProxy(this.SMatic, [], {initializer: "initialize"});
    await sMatic.deployed();
    sMaticImp = await upgrades.erc1967.getImplementationAddress(sMatic.address);
    console.log("sMatic          : " + sMatic.address);
    console.log("imp             : " + sMaticImp);

    cerosRouter = await upgrades.deployProxy(this.CerosRouter, [_aMATICc, _wMatic, ceaMATICc.address, ceVault.address, _dex, _dexPairFee, swapPool.address, priceGetter.address], {initializer: "initialize"}, {gasLimit: 2000000});
    await cerosRouter.deployed();
    cerosRouterImp = await upgrades.erc1967.getImplementationAddress(cerosRouter.address);
    console.log("cerosRouter     : " + cerosRouter.address);
    console.log("imp             : " + cerosRouterImp);

    // MasterVault Deployment
    console.log("MasterVault...");

    masterVault = await upgrades.deployProxy(this.MasterVault, ["CEROS MATIC Vault Token", "ceMATIC", _maxDepositFee, _maxWithdrawalFee, _wMatic, _maxStrategies, swapPool.address], {initializer: "initialize"});
    await masterVault.deployed();
    masterVaultImp = await upgrades.erc1967.getImplementationAddress(masterVault.address);
    console.log("masterVault     : " + masterVault.address);
    console.log("imp             : " + masterVaultImp);

    waitingPool = await upgrades.deployProxy(this.WaitingPool, [masterVault.address, _waitingPoolCap], {initializer: "initialize"});
    await waitingPool.deployed();
    waitingPoolImp = await upgrades.erc1967.getImplementationAddress(waitingPool.address);
    console.log("waitingPool     : " + waitingPool.address);
    console.log("imp             : " + waitingPoolImp);

    cerosYieldConverterStrategy = await upgrades.deployProxy(this.CerosYieldConverterStrategy, [cerosRouter.address, deployer.address, _wMatic, _aMATICc, masterVault.address, swapPool.address], {initializer: "initialize"});
    await cerosYieldConverterStrategy.deployed();
    cerosYieldConverterStrategyImp = await upgrades.erc1967.getImplementationAddress(cerosYieldConverterStrategy.address);
    console.log("cerosStrategy   : " + cerosYieldConverterStrategy.address);
    console.log("imp             : " + cerosYieldConverterStrategyImp);

    // Contracts deployment
    console.log("Core...");

    let abacus = await upgrades.deployProxy(this.Abacus, [], {initializer: "initialize"});
    await abacus.deployed();
    abacusImp = await upgrades.erc1967.getImplementationAddress(abacus.address);
    console.log("Abacus          :", abacus.address);
    console.log("AbacusImp       :", abacusImp);

    if (hre.network.name == "polygon") {
        aggregatorAddress = "0x97371dF4492605486e23Da797fA68e55Fc38a13f";
    } else if (hre.network.name == "mumbai") {
        aggregatorAddress = "0xd0D5e3DB44DE05E9F294BB0a3bEEaF030DE24Ada";
    }

    let oracle = await upgrades.deployProxy(this.Oracle, [aggregatorAddress], {initializer: "initialize"});
    await oracle.deployed();
    let oracleImplementation = await upgrades.erc1967.getImplementationAddress(oracle.address);
    console.log("Deployed: oracle: " + oracle.address);
    console.log("Imp             : " + oracleImplementation);

    let vat = await upgrades.deployProxy(this.Vat, [], {initializer: "initialize"});
    await vat.deployed();
    vatImp = await upgrades.erc1967.getImplementationAddress(vat.address);
    console.log("Vat             :", vat.address);
    console.log("VatImp          :", vatImp);

    let spot = await upgrades.deployProxy(this.Spot, [vat.address], {initializer: "initialize"});
    await spot.deployed();
    spotImp = await upgrades.erc1967.getImplementationAddress(spot.address);
    console.log("Spot            :", spot.address);
    console.log("SpotImp         :", spotImp)

    let sikka = await upgrades.deployProxy(this.Sikka, [_chainId, "SIKKA", "5000000" + wad], {initializer: "initialize"});
    await sikka.deployed();
    sikkaImp = await upgrades.erc1967.getImplementationAddress(sikka.address);
    console.log("sikka           :", sikka.address);
    console.log("sikkaImp        :", sikkaImp);

    let sikkaJoin = await upgrades.deployProxy(this.SikkaJoin, [vat.address, sikka.address], {initializer: "initialize"});
    await sikkaJoin.deployed();
    sikkaJoinImp = await upgrades.erc1967.getImplementationAddress(sikkaJoin.address);
    console.log("SikkaJoin       :", sikkaJoin.address);
    console.log("SikkaJoinImp    :", sikkaJoinImp)

    let gemJoin = await upgrades.deployProxy(this.GemJoin, [vat.address, _ilkCeMatic, masterVault.address], {initializer: "initialize"});
    await gemJoin.deployed();
    gemJoinImp = await upgrades.erc1967.getImplementationAddress(gemJoin.address);
    console.log("GemJoin         :", gemJoin.address);
    console.log("GemJoinImp      :", gemJoinImp);

    let jug = await upgrades.deployProxy(this.Jug, [vat.address], {initializer: "initialize"});
    await jug.deployed();
    jugImp = await upgrades.erc1967.getImplementationAddress(jug.address);
    console.log("Jug             :", jug.address);
    console.log("JugImp          :", jugImp);

    let vow = await upgrades.deployProxy(this.Vow, [vat.address, sikkaJoin.address, _multisig], {initializer: "initialize"});
    await vow.deployed();
    vowImp = await upgrades.erc1967.getImplementationAddress(vow.address);
    console.log("Vow             :", vow.address);
    console.log("VowImp          :", vowImp);

    let dog = await upgrades.deployProxy(this.Dog, [vat.address], {initializer: "initialize"});
    await dog.deployed();
    dogImpl = await upgrades.erc1967.getImplementationAddress(dog.address);
    console.log("Dog             :", dog.address);
    console.log("DogImp          :", dogImpl);

    let clip = await upgrades.deployProxy(this.Clip, [vat.address, spot.address, dog.address, _ilkCeMatic], {initializer: "initialize"});
    await clip.deployed();
    clipImp = await upgrades.erc1967.getImplementationAddress(dog.address);
    console.log("Clip            :", clip.address);
    console.log("ClipImp         :", clipImp);

    let rewards = await upgrades.deployProxy(this.IkkaRewards, [vat.address, ether(_ikkaRewardsPoolLimitInEth).toString()], {initializer: "initialize"});
    await rewards.deployed();
    rewardsImp = await upgrades.erc1967.getImplementationAddress(rewards.address);
    console.log("Rewards         :", rewards.address);
    console.log("Imp             :", rewardsImp);

    // // No Ikka Token & Oracle at the moment
    // let ikkaOracle = await upgrades.deployProxy(this.IkkaOracle, [_ikkaOracleInitialPriceInWei], {initializer: "initialize"}) // 0.1
    // await ikkaOracle.deployed();
    // ikkaOracleImplementation = await upgrades.erc1967.getImplementationAddress(ikkaOracle.address);
    // console.log("ikkaOracle   :", ikkaOracle.address);
    // console.log("Imp          :", ikkaOracleImplementation);

    // // initial ikka token supply for rewards spending
    // let ikkaToken = await upgrades.deployProxy(this.IkkaToken, [ether(_ikkaTokenRewardsSupplyinEth).toString(), rewards.address], {initializer: "initialize"});
    // await ikkaToken.deployed();
    // ikkaTokenImp = await upgrades.erc1967.getImplementationAddress(ikkaToken.address);
    // console.log("ikkaToken    :", ikkaToken.address);
    // console.log("Imp          :", ikkaTokenImp);
    
    // await ikkaToken.rely(rewards.address);
    // await rewards.setIkkaToken(ikkaToken.address);
    // await rewards.setOracle(ikkaOracle.address);
    // await rewards.initPool(masterVault.address, _ilkCeMatic, _rewardsRate, {gasLimit: 2000000}), //6%

    let interaction = await upgrades.deployProxy(this.Interaction, [vat.address, spot.address, sikka.address, sikkaJoin.address, jug.address, dog.address, rewards.address], 
        {
            initializer: "initialize",
            unsafeAllowLinkedLibraries: true,
        }
    );
    await interaction.deployed();
    interactionImplAddress = await upgrades.erc1967.getImplementationAddress(interaction.address);
    console.log("interaction     : " + interaction.address);
    console.log("Imp             : " + interactionImplAddress);
    console.log("AuctionLib      : " + auctionProxy.address);

    let sikkaProvider = await upgrades.deployProxy(this.SikkaProvider, [sMatic.address, masterVault.address, interaction.address], {initializer: "initialize"});
    await sikkaProvider.deployed();
    sikkaProviderImplementation = await upgrades.erc1967.getImplementationAddress(sikkaProvider.address);
    console.log("sikkaProvider   : " + sikkaProvider.address);
    console.log("imp             : " + sikkaProviderImplementation);

    // Initialization
    console.log("SwapPool init...");
    await (await lp.setSwapPool(swapPool.address)).wait();
    await (await swapPool.add(_swapPoolManager, 0)).wait();
    await (await swapPool.setFee(_swapPool_stakeFee , 3)).wait();
    await (await swapPool.setFee(_swapPool_unstakeFee, 4)).wait();
    await (await swapPool.setMaticPool(_maticPool)).wait();

    console.log("Ceros init...");
    await(await ceaMATICc.changeVault(ceVault.address)).wait();
    await(await ceVault.changeRouter(cerosRouter.address)).wait();
    await(await sMatic.changeMinter(sikkaProvider.address)).wait();
    await(await sikkaProvider.changeProxy(interaction.address)).wait();

    console.log("MasterVault init...");
    await(await masterVault.setWaitingPool(waitingPool.address)).wait();
    await(await masterVault.setStrategy(cerosYieldConverterStrategy.address, _cerosStrategyAllocatoin)).wait();
    await(await masterVault.changeProvider(sikkaProvider.address)).wait();

    console.log("Vat init...");
    await(await vat.rely(gemJoin.address)).wait();
    await(await vat.rely(spot.address)).wait();
    await(await vat.rely(sikkaJoin.address)).wait();
    await(await vat.rely(jug.address)).wait();
    await(await vat.rely(dog.address)).wait();
    await(await vat.rely(clip.address)).wait();
    await(await vat.rely(interaction.address)).wait();
    await(await vat["file(bytes32,uint256)"](ethers.utils.formatBytes32String("Line"), _vat_Line + rad)).wait();
    await(await vat["file(bytes32,bytes32,uint256)"](_ilkCeMatic, ethers.utils.formatBytes32String("line"), _vat_line + rad)).wait();
    await(await vat["file(bytes32,bytes32,uint256)"](_ilkCeMatic, ethers.utils.formatBytes32String("dust"), _vat_dust + ray)).wait();
    
    console.log("Sikka init...");
    await(await sikka.rely(sikkaJoin.address)).wait();
    await(await sikka.setSupplyCap("5000000" + wad)).wait();

    console.log("Spot init...");
    await(await spot.rely(interaction.address)).wait();
    await(await spot["file(bytes32,bytes32,address)"](_ilkCeMatic, ethers.utils.formatBytes32String("pip"), oracle.address)).wait();
    await(await spot["file(bytes32,uint256)"](ethers.utils.formatBytes32String("par"), _spot_par + ray)).wait(); // It means pegged to 1$

    console.log("Rewards init...");
    await(await rewards.rely(interaction.address)).wait();

    console.log("Joins init...");
    await(await gemJoin.rely(interaction.address)).wait();
    await(await sikkaJoin.rely(interaction.address)).wait();
    await(await sikkaJoin.rely(vow.address)).wait();

    console.log("Dog init...");
    await(await dog.rely(interaction.address)).wait();
    await(await dog.rely(clip.address)).wait();
    await(await dog["file(bytes32,address)"](ethers.utils.formatBytes32String("vow"), vow.address)).wait();
    await(await dog["file(bytes32,uint256)"](ethers.utils.formatBytes32String("Hole"), _dog_Hole + rad)).wait();
    await(await dog["file(bytes32,bytes32,uint256)"](_ilkCeMatic, ethers.utils.formatBytes32String("hole"), _dog_hole + rad)).wait();
    await(await dog["file(bytes32,bytes32,uint256)"](_ilkCeMatic, ethers.utils.formatBytes32String("chop"), _dog_chop)).wait();
    await(await dog["file(bytes32,bytes32,address)"](_ilkCeMatic, ethers.utils.formatBytes32String("clip"), clip.address)).wait();

    console.log("Clip init...");
    await(await clip.rely(interaction.address)).wait();
    await(await clip.rely(dog.address)).wait();
    await(await clip["file(bytes32,uint256)"](ethers.utils.formatBytes32String("buf"), _clip_buf)).wait(); // 10%
    await(await clip["file(bytes32,uint256)"](ethers.utils.formatBytes32String("tail"), _clip_tail)).wait(); // 3H reset time
    await(await clip["file(bytes32,uint256)"](ethers.utils.formatBytes32String("cusp"), _clip_cusp)).wait(); // 60% reset ratio
    await(await clip["file(bytes32,uint256)"](ethers.utils.formatBytes32String("chip"), _clip_chip)).wait(); // 0.01% vow incentive
    await(await clip["file(bytes32,uint256)"](ethers.utils.formatBytes32String("tip"), _clip_tip + rad)).wait(); // 10$ flat incentive
    await(await clip["file(bytes32,uint256)"](ethers.utils.formatBytes32String("stopped"), _clip_stopped)).wait();
    await(await clip["file(bytes32,address)"](ethers.utils.formatBytes32String("spotter"), spot.address)).wait();
    await(await clip["file(bytes32,address)"](ethers.utils.formatBytes32String("dog"), dog.address)).wait();
    await(await clip["file(bytes32,address)"](ethers.utils.formatBytes32String("vow"), vow.address)).wait();
    await(await clip["file(bytes32,address)"](ethers.utils.formatBytes32String("calc"), abacus.address)).wait();

    console.log("Jug...");
    await(await jug.rely(interaction.address)).wait();
    // Initialize Rates Module
    // IMPORTANT: Base and Duty are added together first, thus will compound together.
    //            It is adviced to set a constant base first then duty for all ilks.
    //            Otherwise, a change in base rate will require a change in all ilks rate.
    //            Due to addition of both rates, the ratio should be adjusted by factoring.
    //            rate(Base) + rate(Duty) != rate(Base + Duty)

    // Calculating Base Rate (1% Yearly)
    // ==> principal*(rate**seconds)-principal = 0.01 (1%)
    // ==> 1 * (BR ** 31536000 seconds) - 1 = 0.01
    // ==> 1*(BR**31536000) = 1.01
    // ==> BR**31536000 = 1.01
    // ==> BR = 1.01**(1/31536000)
    // ==> BR = 1.000000000315529215730000000 [ray]
    // Factoring out Ilk Duty Rate (1% Yearly)
    // ((1 * (BR + 0.000000000312410000000000000 DR)^31536000)-1) * 100 = 0.000000000312410000000000000 = 2% (BR + DR Yearly)
    
    // 1000000000315522921573372069 1% Borrow Rate
    // 1000000000627937192491029810 2% Borrow Rate
    // 1000000000937303470807876290 3% Borrow Rate
    // 1000000003022266000000000000 10% Borrow Rate
    // ***We don't set base rate. We set only duty rate via interaction***
    // await(await jug["file(bytes32,uint256)"](ethers.utils.formatBytes32String("base"), "1000000000627937192491029810")).wait();
    await(await jug["file(bytes32,address)"](ethers.utils.formatBytes32String("vow"), vow.address)).wait();

    console.log("Vow init...");
    await(await vow.rely(dog.address)).wait();
    await(await vow["file(bytes32,address)"](ethers.utils.formatBytes32String("sikka"), sikka.address)).wait();

    console.log("Interaction init...");
    await(await interaction.setSikkaProvider(masterVault.address, sikkaProvider.address)).wait();
    tx = await interaction.setCollateralType(masterVault.address, gemJoin.address, _ilkCeMatic, clip.address, _mat, {gasLimit: 700000});
    await ethers.provider.waitForTransaction(tx.hash, 1, 60000);
    tx = await interaction.poke(masterVault.address, {gasLimit: 200000});
    await ethers.provider.waitForTransaction(tx.hash, 1, 60000);
    tx = await interaction.drip(masterVault.address, {gasLimit: 200000});
    await ethers.provider.waitForTransaction(tx.hash, 1, 60000);
    await(await interaction.enableWhitelist()).wait();  // Deposits are limited to whitelist
    await(await interaction.setWhitelistOperator(_whitelistOperator)).wait();  // Whitelist manager
    tx = await interaction.setCollateralDuty(masterVault.address, "1000000000627937192491029810", {gasLimit: 250000});
    await ethers.provider.waitForTransaction(tx.hash, 1, 60000);

    console.log("Abaci init...");
    await(await abacus.connect(deployer)["file(bytes32,uint256)"](ethers.utils.formatBytes32String("tau"), _abacus_tau)).wait(); // Price will reach 0 after this time

    // Store deployed addresses
    const addresses = {
        ceaMATICc      : ceaMATICc.address,
        ceaMATICcImp   : ceaMATICcImp,
        ceVault        : ceVault.address,
        ceVaultImp     : ceVaultImp,
        sMatic         : sMatic.address,
        sMaticImp      : sMaticImp,
        cerosRouter    : cerosRouter.address,
        cerosRouterImp : cerosRouterImp,
        masterVault    : masterVault.address,
        masterVaultImp : masterVaultImp,
        waitingPool    : waitingPool.address,
        waitingPoolImp : waitingPoolImp,
        cerosYieldStr  : cerosYieldConverterStrategy.address,
        cerosYieldConverterStrategyImp  : cerosYieldConverterStrategyImp,
        abacus         : abacus.address,
        abacusImp      : abacusImp,
        oracle         : oracle.address,
        oracleImp      : oracleImplementation,
        vat            : vat.address,
        vatImp         : vatImp,
        spot           : spot.address,
        spotImp        : spotImp,
        sikka          : sikka.address,
        sikkaImp       : sikkaImp,
        sikkaJoin      : sikkaJoin.address,
        sikkaJoinImp   : sikkaJoinImp,
        gemJoin        : gemJoin.address,
        gemJoinImp     : gemJoinImp,
        jug            : jug.address,
        jugImp         : jugImp,
        vow            : vow.address,
        vowImp         : vowImp,
        dog            : dog.address,
        dogImp         : dogImpl,
        clip           : clip.address,
        clipImp        : clipImp,
        rewards        : rewards.address,
        rewardsImp     : rewardsImp,
        interaction    : interaction.address,
        interactionImp : interactionImplAddress,
        auctionProxy   : auctionProxy.address,
        sikkaProvider  : sikkaProvider.address,
        sikkaProviderImp: sikkaProviderImplementation,
        priceGetter     : priceGetter.address,
        LP              : lp.address,
        LPImp           : lpImplementation,
        swapPool        : swapPool.address,
        swapPoolImp     : swapPoolImplementation,
        // ikkaToken    : ikkaToken.address,
        // ikkaTokenImp : ikkaTokenImp,
        // ikkaOracle   : ikkaOracle.address,
        // ikkaOracleImp: ikkaOracleImp,
        ilk             : _ilkCeMatic,
    }

    const json_addresses = JSON.stringify(addresses);
    fs.writeFileSync(`./scripts/${network.name}_addresses.json`, json_addresses);
    console.log("Addresses Recorded to: " + `./scripts/${network.name}_addresses.json`);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
});