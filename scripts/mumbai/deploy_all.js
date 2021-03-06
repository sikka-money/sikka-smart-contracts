let hre = require("hardhat");
let {ethers, upgrades} = require("hardhat");
const {BN, ether} = require("@openzeppelin/test-helpers");

async function main() {

    [deployer] = await ethers.getSigners();
    let ceaMATICc, 
        ceVault,  
        sMatic, 
        cerosRouter;
    // External Addresses
    let _aMATICc = "0xaC32206a73C8406D74eB21cF7bd060bf841e64aD", 
        _wMatic = "0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889",
        _dex = "0xE592427A0AEce92De3Edee1F18E0157C05861564",
        _dexPairFee = "3000";
        _swapPool = "0xFCC0937847030e91567c78a147e6e36F719Dc46b",
        _priceGetter = "0x081CCd6331b816584F42cBAa09c556798F41fef7",
        _maxDepositFee = 500000, 
        _maxWithdrawalFee = 500000,
        _maxStrategies = 10,
        _ilkCeMatic = ethers.utils.formatBytes32String("ceMATIC");
    
    // Contracts Fetching
    this.CeaMATICc = await hre.ethers.getContractFactory("CeToken");
    this.CeVault = await hre.ethers.getContractFactory("CeVault");
    this.AMATICb = await hre.ethers.getContractFactory("aMATICb");
    this.AMATICc = await hre.ethers.getContractFactory("aMATICc");
    this.SMatic = await hre.ethers.getContractFactory("sMATIC");
    this.CerosRouter = await hre.ethers.getContractFactory("CerosRouter");

    // Contracts deployment and initialization
    ceaMATICc = await upgrades.deployProxy(this.CeaMATICc, ["CEROS aMATICc Vault Token", "ceaMATICc"], {initializer: "initialize"});
    await ceaMATICc.deployed();
    ceaMATICcImplementation = await upgrades.erc1967.getImplementationAddress(ceaMATICc.address);
    console.log("ceaMATICc  : " + ceaMATICc.address);
    console.log("imp        : " + ceaMATICcImplementation);

    ceVault = await upgrades.deployProxy(this.CeVault, ["CEROS aMATICc Vault", ceaMATICc.address, _aMATICc], {initializer: "initialize"});
    await ceVault.deployed();
    ceVaultImplementation = await upgrades.erc1967.getImplementationAddress(ceVault.address);
    console.log("ceVault    : " + ceVault.address);
    console.log("imp        : " + ceVaultImplementation);

    sMatic = await upgrades.deployProxy(this.SMatic, [], {initializer: "initialize"});
    await sMatic.deployed();
    sMaticImplementation = await upgrades.erc1967.getImplementationAddress(sMatic.address);
    console.log("sMatic     : " + sMatic.address);
    console.log("imp        : " + sMaticImplementation);

    cerosRouter = await upgrades.deployProxy(this.CerosRouter, [_aMATICc, _wMatic, ceaMATICc.address, ceVault.address, _dex, _dexPairFee, _swapPool, _priceGetter], {initializer: "initialize"}, {gasLimit: 2000000});
    await cerosRouter.deployed();
    cerosRouterImplementation = await upgrades.erc1967.getImplementationAddress(cerosRouter.address);
    console.log("cerosRouter: " + cerosRouter.address);
    console.log("imp        : " + cerosRouterImplementation);

    await ceaMATICc.changeVault(ceVault.address);
    await ceVault.changeRouter(cerosRouter.address);

    this.MasterVault = await hre.ethers.getContractFactory("MasterVault");
    this.WaitingPool = await hre.ethers.getContractFactory("WaitingPool");
    masterVault = await upgrades.deployProxy(this.MasterVault, ["CEROS MATIC Vault Token", "ceMATIC", _maxDepositFee, _maxWithdrawalFee, _wMatic, _maxStrategies, _swapPool], {initializer: "initialize"});
    await masterVault.deployed();
    masterVaultImplementation = await upgrades.erc1967.getImplementationAddress(masterVault.address);
    console.log("masterVault    : " + masterVault.address);
    console.log("imp        : " + masterVaultImplementation);

    waitingPool = await upgrades.deployProxy(this.WaitingPool, [masterVault.address], {initializer: "initialize"});
    await waitingPool.deployed();
    waitingPoolImplementation = await upgrades.erc1967.getImplementationAddress(waitingPool.address);
    console.log("waitingPool    : " + waitingPool.address);
    console.log("imp        : " + waitingPoolImplementation);

    await masterVault.setWaitingPool(waitingPool.address)

    _destination = cerosRouter.address,
    _feeRecipient = deployer.address,
    _underlyingToken = _wMatic,
    _certToekn = _aMATICc,
    _rewardsPool = deployer.address,
    _performanceFees = 0,
    _cerosStrategyAllocatoin = 80 * 10000; // 80%

    this.CerosYieldConverterStrategy = await hre.ethers.getContractFactory("CerosYieldConverterStrategy");
    this.MasterVault = await hre.ethers.getContractFactory("MasterVault");
    
    cerosYieldConverterStrategy = await upgrades.deployProxy(this.CerosYieldConverterStrategy, [_destination, _feeRecipient, _underlyingToken, cerosRouter.address, _certToekn, masterVault.address, _rewardsPool, _swapPool], {initializer: "initialize"});
    await cerosYieldConverterStrategy.deployed();
    cerosYieldConverterStrategyImp = await upgrades.erc1967.getImplementationAddress(cerosYieldConverterStrategy.address);
    console.log("cerosYieldConverterStrategy    : " + cerosYieldConverterStrategy.address);
    console.log("imp        : " + cerosYieldConverterStrategyImp);

    masterVault = await this.MasterVault.attach(masterVault.address);
    await masterVault.setStrategy(cerosYieldConverterStrategy.address, _cerosStrategyAllocatoin);

    // Contracts Fetching
    this.Vat = await hre.ethers.getContractFactory("Vat");
    this.Spot = await hre.ethers.getContractFactory("Spotter");
    this.Sikka = await hre.ethers.getContractFactory("Sikka");
    this.GemJoin = await hre.ethers.getContractFactory("GemJoin");
    this.SikkaJoin = await hre.ethers.getContractFactory("SikkaJoin");
    this.Jug = await hre.ethers.getContractFactory("Jug");
    this.Vow = await hre.ethers.getContractFactory("Vow");
    this.Dog = await hre.ethers.getContractFactory("Dog");
    this.Clip = await hre.ethers.getContractFactory("Clipper");
    this.Oracle = await hre.ethers.getContractFactory("Oracle"); // Mock Oracle
    this.Abacus = await hre.ethers.getContractFactory("LinearDecrease");

    // Contracts deployment
    let vat = await upgrades.deployProxy(this.Vat, [], {initializer: "initialize"});
    await vat.deployed();
    vatImplementation = await upgrades.erc1967.getImplementationAddress(vat.address);
    console.log("Vat            :", vat.address);
    console.log("VatImp         :", vatImplementation)

    let spot = await this.Spot.deploy(vat.address);
    await spot.deployed();
    console.log("Spot           :", spot.address);

    let sikka = await this.Sikka.deploy(80001, "SIKKA");
    await sikka.deployed();
    console.log("Sikka          :", sikka.address);

    let sikkaJoin = await this.SikkaJoin.deploy(vat.address, sikka.address);
    await sikkaJoin.deployed();
    console.log("SikkaJoin      :", sikkaJoin.address);

    let ceaMATICcJoin = await this.GemJoin.deploy(vat.address, _ilkCeMatic, masterVault.address);
    await ceaMATICcJoin.deployed();
    console.log("ceaMATICcJoin  :", ceaMATICcJoin.address);

    let jug = await this.Jug.deploy(vat.address);
    await jug.deployed();
    console.log("Jug            :", jug.address);

    let vow = await this.Vow.deploy(vat.address, ethers.constants.AddressZero, ethers.constants.AddressZero, deployer.address);
    await vow.deployed();
    console.log("Vow            :", vow.address);

    let dog = await this.Dog.deploy(vat.address);
    await dog.deployed();
    console.log("Dog            :", dog.address);

    let clip = await this.Clip.deploy(vat.address, spot.address, dog.address, _ilkCeMatic);
    await clip.deployed();
    console.log("Clip           :", clip.address);

    let oracle = await this.Oracle.deploy();
    await oracle.deployed();
    console.log("Oracle         :", oracle.address);

    let abacus = await this.Abacus.deploy();
    await abacus.deployed();
    console.log("Abacus         :", abacus.address);

    console.log("Verifying Sikka...");

    // Contracts Fetching
    this.IkkaToken = await hre.ethers.getContractFactory("IkkaToken");
    this.IkkaRewards = await hre.ethers.getContractFactory("IkkaRewards");
    this.IkkaOracle = await hre.ethers.getContractFactory("IkkaOracle");

    // Contracts deployment
    let rewards = await upgrades.deployProxy(this.IkkaRewards, [vat.address, ether("100000000").toString()], {initializer: "initialize"});
    await rewards.deployed();
    rewardsImplementation = await upgrades.erc1967.getImplementationAddress(rewards.address);
    console.log("Rewards             :", rewards.address);
    console.log("Imp                 :", rewardsImplementation);

    let ikkaToken = await this.IkkaToken.deploy(ether("100000000").toString(), rewards.address);
    await ikkaToken.deployed();
    console.log("ikkaToken           :", ikkaToken.address);
    
    let ikkaOracle = await upgrades.deployProxy(this.IkkaOracle, ["100000000000000000"], {initializer: "initialize"}); // 0.1
    await ikkaOracle.deployed();
    ikkaOracleImplementation = await upgrades.erc1967.getImplementationAddress(ikkaOracle.address);
    console.log("ikkaOracle          :", ikkaOracle.address);
    console.log("Imp                 :", ikkaOracleImplementation);

    await ikkaToken.rely(rewards.address);
    await rewards.setIkkaToken(ikkaToken.address);
    await rewards.initPool(masterVault.address, _ilkCeMatic, "1000000001847694957439350500", {gasLimit: 2000000}); //6%
    await rewards.setOracle(ikkaOracle.address);

    _vat = vat.address,
    _spot = spot.address,
    _sikka = sikka.address,
    _sikkaJoin = sikkaJoin.address,
    _jug = jug.address,
    _dog = dog.address,
    _rewards = rewards.address;

    // Contracts Fetching
    this.Rewards = await hre.ethers.getContractFactory("IkkaRewards");
    rewards = this.Rewards.attach(_rewards);
    this.AuctionProxy = await hre.ethers.getContractFactory("AuctionProxy");
    let auctionProxy = await this.AuctionProxy.deploy();
    await auctionProxy.deployed();
    console.log("AuctionProxy.lib          : ", auctionProxy.address);
    this.Interaction = await hre.ethers.getContractFactory("Interaction", {
        unsafeAllow: ['external-library-linking'],
        libraries: {
            AuctionProxy: auctionProxy.address
        }
    });
    let interaction = await upgrades.deployProxy(this.Interaction, [
        _vat,
        _spot,
        _sikka,
        _sikkaJoin,
        _jug,
        _dog,
        rewards.address
    ], {
        initializer: "initialize",
        unsafeAllowLinkedLibraries: true,
    });
    await interaction.deployed();
    console.log("interaction               : ", interaction.address);
    
    this.Vat = await hre.ethers.getContractFactory("Vat");
    vat = this.Vat.attach(_vat);
    await vat.rely(interaction.address);
    await rewards.rely(interaction.address);

    interactionImplAddress = await upgrades.erc1967.getImplementationAddress(interaction.address);
    console.log("Interaction implementation: ", interactionImplAddress);

    // Contracts Fetching
    this.SikkaProvider = await hre.ethers.getContractFactory("SikkaProvider");
    this.SMatic = await hre.ethers.getContractFactory("sMATIC");
    this.CerosRouter = await hre.ethers.getContractFactory("CerosRouter");
    this.MasterVault = await hre.ethers.getContractFactory("MasterVault");

    sikkaProvider = await upgrades.deployProxy(this.SikkaProvider, [sMatic.address, masterVault.address, interaction.address], {initializer: "initialize"});
    await sikkaProvider.deployed();
    sikkaProviderImplementation = await upgrades.erc1967.getImplementationAddress(sikkaProvider.address);
    console.log("sikkaProvider  : " + sikkaProvider.address);
    console.log("imp           : " + sikkaProviderImplementation);

    masterVault = this.MasterVault.attach(masterVault.address);
    sMatic = await this.SMatic.attach(sMatic.address);
    await sMatic.changeMinter(sikkaProvider.address);
    await masterVault.changeProvider(sikkaProvider.address)

    let wad = "000000000000000000", // 18 Decimals
        ray = "000000000000000000000000000", // 27 Decimals
        rad = "000000000000000000000000000000000000000000000", // 45 Decimals
        ONE = 10 ** 27;

    // Contracts Attachments
    this.Vat = await hre.ethers.getContractFactory("Vat");
    this.Rewards = await hre.ethers.getContractFactory("IkkaRewards");
    this.GemJoin = await hre.ethers.getContractFactory("GemJoin");
    this.SikkaJoin = await hre.ethers.getContractFactory("SikkaJoin");
    this.Dog = await hre.ethers.getContractFactory("Dog");
    this.Jug = await hre.ethers.getContractFactory("Jug");
    this.AuctionProxy = await hre.ethers.getContractFactory("AuctionProxy");
    auctionProxy = await this.AuctionProxy.attach(auctionProxy.address);
    this.Interaction = await hre.ethers.getContractFactory("Interaction", {
      unsafeAllow: ['external-library-linking'],
      libraries: {
          AuctionProxy: auctionProxy.address
      }
    });
    this.Spot = await hre.ethers.getContractFactory("Spotter");
    this.Sikka = await hre.ethers.getContractFactory("Sikka");
    this.Clip = await hre.ethers.getContractFactory("Clipper");
    this.Vow = await hre.ethers.getContractFactory("Vow");
    this.SikkaProvider = await hre.ethers.getContractFactory("SikkaProvider");
    this.MasterVault = await hre.ethers.getContractFactory("MasterVault");
    this.Oracle = await hre.ethers.getContractFactory("Oracle");
    this.Abacus = await hre.ethers.getContractFactory("LinearDecrease");

    vat = await this.Vat.attach(_vat);
    rewards = await this.Rewards.attach(_rewards);
    gemJoin = await this.GemJoin.attach(ceaMATICcJoin.address);
    sikkaJoin = await this.SikkaJoin.attach(_sikkaJoin);
    dog = await this.Dog.attach(_dog);
    jug = await this.Jug.attach(_jug);
    interaction = await this.Interaction.attach(interaction.address);
    spot = await this.Spot.attach(_spot);
    sikka = await this.Sikka.attach(_sikka);
    clip = await this.Clip.attach(clip.address);
    vow = await this.Vow.attach(vow.address);
    sikkaProvider = await this.SikkaProvider.attach(sikkaProvider.address);
    masterVault = await this.MasterVault.attach(masterVault.address);
    oracle = await this.Oracle.attach(oracle.address);
    abacus = await this.Abacus.attach(abacus.address);

    // Contracts initializing
    console.log("Vat init...");
    await vat.rely(ceaMATICcJoin.address);
    await vat.rely(_spot);
    await vat.rely(_sikkaJoin);
    await vat.rely(_jug);
    await vat.rely(_dog);
    await vat.rely(interaction.address);
    await vat.rely(clip.address);
    await vat["file(bytes32,uint256)"](ethers.utils.formatBytes32String("Line"), "500000000" + rad);
    await vat["file(bytes32,bytes32,uint256)"](_ilkCeMatic, ethers.utils.formatBytes32String("line"), "50000000" + rad);
    await vat["file(bytes32,bytes32,uint256)"](_ilkCeMatic, ethers.utils.formatBytes32String("dust"), "1" + ray);

    console.log("Vow init...");
    await vow.rely(_dog);

    console.log("All init...");
    await rewards.rely(interaction.address);
    await gemJoin.rely(interaction.address);
    await sikkaJoin.rely(interaction.address);
    await dog.rely(interaction.address);
    await jug.rely(interaction.address);
    await clip.rely(interaction.address);
    await interaction.setSikkaProvider(masterVault.address, sikkaProvider.address);

    // 2.000000000000000000000000000 ($) * 0.8 (80%) = 1.600000000000000000000000000,
    // 2.000000000000000000000000000 / 1.600000000000000000000000000 = 1.250000000000000000000000000 = mat
    console.log("Spot/Oracle...");
    await oracle.setPrice("2" + wad); // 2$
    await spot["file(bytes32,bytes32,address)"](_ilkCeMatic, ethers.utils.formatBytes32String("pip"), oracle.address);
    await spot["file(bytes32,bytes32,uint256)"](_ilkCeMatic, ethers.utils.formatBytes32String("mat"), "1333333333333333333333333333"); // Liquidation Ratio 75%
    await spot["file(bytes32,uint256)"](ethers.utils.formatBytes32String("par"), "1" + ray); // It means pegged to 1$
    await spot.poke(_ilkCeMatic, {gasLimit: 200000});

    console.log("Jug...");
    BR = new BN("1000000003022266000000000000").toString(); // 10%
    await jug["file(bytes32,uint256)"](ethers.utils.formatBytes32String("base"), BR); // 10% Yearly
    await jug["file(bytes32,address)"](ethers.utils.formatBytes32String("vow"), vow.address);

    console.log("Sikka...");
    await sikka.rely(sikkaJoin.address);

    console.log("Dog...");
    await dog.rely(clip.address);
    await dog["file(bytes32,address)"](ethers.utils.formatBytes32String("vow"), vow.address);
    await dog["file(bytes32,uint256)"](ethers.utils.formatBytes32String("Hole"), "500" + rad);
    await dog["file(bytes32,bytes32,uint256)"](_ilkCeMatic, ethers.utils.formatBytes32String("hole"), "250" + rad);
    await dog["file(bytes32,bytes32,uint256)"](_ilkCeMatic, ethers.utils.formatBytes32String("chop"), "1130000000000000000"); // 13%
    await dog["file(bytes32,bytes32,address)"](_ilkCeMatic, ethers.utils.formatBytes32String("clip"), clip.address);

    console.log("Clip/Abacus...");
    await abacus.connect(deployer)["file(bytes32,uint256)"](ethers.utils.formatBytes32String("tau"), "3600"); // Price will reach 0 after this time
    await clip.rely(dog.address);
    await clip["file(bytes32,uint256)"](ethers.utils.formatBytes32String("buf"), "1020000000000000000000000000"); // 2%
    await clip["file(bytes32,uint256)"](ethers.utils.formatBytes32String("tail"), "1800"); // 30mins reset time
    await clip["file(bytes32,uint256)"](ethers.utils.formatBytes32String("cusp"), "600000000000000000000000000"); // 60% reset ratio
    await clip["file(bytes32,uint256)"](ethers.utils.formatBytes32String("chip"), "10000000000000000"); // 1% from vow incentive
    await clip["file(bytes32,uint256)"](ethers.utils.formatBytes32String("tip"), "10" + rad); // 10$ flat fee incentive
    await clip["file(bytes32,uint256)"](ethers.utils.formatBytes32String("stopped"), "0");
    await clip["file(bytes32,address)"](ethers.utils.formatBytes32String("spotter"), spot.address);
    await clip["file(bytes32,address)"](ethers.utils.formatBytes32String("dog"), dog.address);
    await clip["file(bytes32,address)"](ethers.utils.formatBytes32String("vow"), vow.address);
    await clip["file(bytes32,address)"](ethers.utils.formatBytes32String("calc"), abacus.address);

    console.log("Interaction...");
    await interaction.setCollateralType(masterVault.address, gemJoin.address, _ilkCeMatic, clip.address);

    console.log("DEPLOYMENT LIVE");
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
});
