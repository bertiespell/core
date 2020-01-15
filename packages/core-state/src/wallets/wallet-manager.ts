import { app } from "@arkecosystem/core-container";
import { Consensus, Logger, State } from "@arkecosystem/core-interfaces";
import { Handlers, Interfaces as TransactionInterfaces } from "@arkecosystem/core-transactions";
import { Enums, Identities, Interfaces, Utils } from "@arkecosystem/crypto";
import { WalletIndexAlreadyRegisteredError, WalletIndexNotFoundError } from "./errors";
import { TempWalletManager } from "./temp-wallet-manager";
import { Wallet } from "./wallet";
import { WalletIndex } from "./wallet-index";

export class WalletManager implements State.IWalletManager {
    // @TODO: make this private and read-only
    public logger: Logger.ILogger = app.resolvePlugin<Logger.ILogger>("logger");

    protected readonly indexes: Record<string, State.IWalletIndex> = {};
    private currentBlock: Interfaces.IBlock;

    constructor() {
        this.reset();

        this.registerIndex(State.WalletIndexes.Addresses, (index: State.IWalletIndex, wallet: State.IWallet) => {
            if (wallet.address) {
                index.set(wallet.address, wallet);
            }
        });

        this.registerIndex(State.WalletIndexes.PublicKeys, (index: State.IWalletIndex, wallet: State.IWallet) => {
            if (wallet.publicKey) {
                index.set(wallet.publicKey, wallet);
            }
        });

        this.registerIndex(State.WalletIndexes.Usernames, (index: State.IWalletIndex, wallet: State.IWallet) => {
            if (wallet.isDelegate()) {
                index.set(wallet.getAttribute("delegate.username"), wallet);
            }
        });

        this.registerIndex(State.WalletIndexes.Resignations, (index: State.IWalletIndex, wallet: State.IWallet) => {
            if (wallet.isDelegate() && wallet.getAttribute("delegate.resigned")) {
                index.set(wallet.getAttribute("delegate.username"), wallet);
            }
        });

        this.registerIndex(State.WalletIndexes.Locks, (index: State.IWalletIndex, wallet: State.IWallet) => {
            const locks = wallet.getAttribute("htlc.locks");
            if (locks) {
                for (const lockId of Object.keys(locks)) {
                    index.set(lockId, wallet);
                }
            }
        });

        this.registerIndex(State.WalletIndexes.Ipfs, (index: State.IWalletIndex, wallet: State.IWallet) => {
            const hashes = wallet.getAttribute("ipfs.hashes");
            if (hashes) {
                for (const hash of Object.keys(hashes)) {
                    index.set(hash, wallet);
                }
            }
        });
    }

    public registerIndex(name: string, indexer: State.WalletIndexer): void {
        if (this.indexes[name]) {
            throw new WalletIndexAlreadyRegisteredError(name);
        }

        this.indexes[name] = new WalletIndex(indexer);
    }

    public unregisterIndex(name: string): void {
        if (!this.indexes[name]) {
            throw new WalletIndexNotFoundError(name);
        }

        delete this.indexes[name];
    }

    public getIndex(name: string): State.IWalletIndex {
        if (!this.indexes[name]) {
            throw new WalletIndexNotFoundError(name);
        }

        return this.indexes[name];
    }

    public getIndexNames(): string[] {
        return Object.keys(this.indexes);
    }

    public allByAddress(): ReadonlyArray<State.IWallet> {
        return this.getIndex(State.WalletIndexes.Addresses).values();
    }

    public allByPublicKey(): ReadonlyArray<State.IWallet> {
        return this.getIndex(State.WalletIndexes.PublicKeys).values();
    }

    public allByUsername(): ReadonlyArray<State.IWallet> {
        return this.getIndex(State.WalletIndexes.Usernames).values();
    }

    public findById(id: string): State.IWallet {
        for (const index of Object.values(this.indexes)) {
            const wallet: State.IWallet = index.get(id);
            if (wallet) {
                return wallet;
            }
        }

        return undefined;
    }

    public findByAddress(address: string): State.IWallet {
        const index: State.IWalletIndex = this.getIndex(State.WalletIndexes.Addresses);
        if (address && !index.has(address)) {
            index.set(address, new Wallet(address));
        }

        return index.get(address);
    }

    public findByPublicKey(publicKey: string): State.IWallet {
        const index: State.IWalletIndex = this.getIndex(State.WalletIndexes.PublicKeys);
        if (publicKey && !index.has(publicKey)) {
            const address: string = Identities.Address.fromPublicKey(publicKey);
            const wallet: State.IWallet = this.findByAddress(address);
            wallet.publicKey = publicKey;
            index.set(publicKey, wallet);
        }

        return index.get(publicKey);
    }

    public findByUsername(username: string): State.IWallet {
        return this.findByIndex(State.WalletIndexes.Usernames, username);
    }

    public findByIndex(index: string | string[], key: string): State.IWallet | undefined {
        if (!Array.isArray(index)) {
            index = [index];
        }

        for (const name of index) {
            const index = this.getIndex(name);
            if (index.has(key)) {
                return index.get(key);
            }
        }

        return undefined;
    }

    public has(key: string): boolean {
        for (const walletIndex of Object.values(this.indexes)) {
            if (walletIndex.has(key)) {
                return true;
            }
        }

        return false;
    }

    public hasByAddress(address: string): boolean {
        return this.hasByIndex(State.WalletIndexes.Addresses, address);
    }

    public hasByPublicKey(publicKey: string): boolean {
        return this.hasByIndex(State.WalletIndexes.PublicKeys, publicKey);
    }

    public hasByUsername(username: string): boolean {
        return this.hasByIndex(State.WalletIndexes.Usernames, username);
    }

    public hasByIndex(indexName: string, key: string): boolean {
        return this.getIndex(indexName).has(key);
    }

    public getNonce(publicKey: string): Utils.BigNumber {
        if (this.hasByPublicKey(publicKey)) {
            return this.findByPublicKey(publicKey).nonce;
        }

        return Utils.BigNumber.ZERO;
    }

    public forgetByAddress(address: string): void {
        this.forgetByIndex(State.WalletIndexes.Addresses, address);
    }

    public forgetByPublicKey(publicKey: string): void {
        this.forgetByIndex(State.WalletIndexes.PublicKeys, publicKey);
    }

    public forgetByUsername(username: string): void {
        this.forgetByIndex(State.WalletIndexes.Usernames, username);
    }

    public forgetByIndex(indexName: string, key: string): void {
        this.getIndex(indexName).forget(key);
    }

    public index(wallets: ReadonlyArray<State.IWallet>): void {
        for (const wallet of wallets) {
            this.reindex(wallet);
        }
    }

    public reindex(wallet: State.IWallet): void {
        for (const walletIndex of Object.values(this.indexes)) {
            walletIndex.index(wallet);
        }
    }

    public getCurrentBlock(): Readonly<Interfaces.IBlock> {
        return this.currentBlock;
    }

    public clone(): WalletManager {
        return new TempWalletManager(this);
    }

    public async applyBlock(block: Interfaces.IBlock): Promise<void> {
        this.currentBlock = block;
        const generatorPublicKey: string = block.data.generatorPublicKey;

        let delegate: State.IWallet;
        if (!this.has(generatorPublicKey)) {
            const generator: string = Identities.Address.fromPublicKey(generatorPublicKey);

            if (block.data.height === 1) {
                delegate = new Wallet(generator);
                delegate.publicKey = generatorPublicKey;

                this.reindex(delegate);
            } else {
                app.forceExit(`Failed to lookup generator '${generatorPublicKey}' of block '${block.data.id}'.`);
            }
        } else {
            delegate = this.findByPublicKey(block.data.generatorPublicKey);
        }

        const appliedTransactions: Interfaces.ITransaction[] = [];

        try {
            for (const transaction of block.transactions) {
                await this.applyTransaction(transaction);
                appliedTransactions.push(transaction);
            }

            const applied: boolean = delegate.applyBlock(block.data);

            // If the block has been applied to the delegate, the balance is increased
            // by reward + totalFee. In which case the vote balance of the
            // delegate's delegate has to be updated.
            if (applied && delegate.hasVoted()) {
                // TODO: move
                const increase: Utils.BigNumber = block.data.reward.plus(block.data.totalFee);
                const votedDelegate: State.IWallet = this.findByPublicKey(delegate.getAttribute<string>("vote"));
                const voteBalance: Utils.BigNumber = votedDelegate.getAttribute("delegate.voteBalance");
                votedDelegate.setAttribute("delegate.voteBalance", voteBalance.plus(increase));
            }
        } catch (error) {
            this.logger.error("Failed to apply all transactions in block - reverting previous transactions");

            // Revert the applied transactions from last to first
            for (const transaction of appliedTransactions.reverse()) {
                await this.revertTransaction(transaction);
            }

            throw error;
        } finally {
            this.currentBlock = undefined;
        }
    }

    public async revertBlock(block: Interfaces.IBlock): Promise<void> {
        if (!this.has(block.data.generatorPublicKey)) {
            app.forceExit(`Failed to lookup generator '${block.data.generatorPublicKey}' of block '${block.data.id}'.`);
        }
        this.currentBlock = block;

        const revertedTransactions: Interfaces.ITransaction[] = [];

        try {
            // Revert the transactions from last to first
            for (let i = block.transactions.length - 1; i >= 0; i--) {
                const transaction: Interfaces.ITransaction = block.transactions[i];
                await this.revertTransaction(transaction);
                revertedTransactions.push(transaction);
            }

        } catch (error) {
            this.logger.error(error.stack);

            for (const transaction of revertedTransactions.reverse()) {
                await this.applyTransaction(transaction);
            }

            throw error;
        } finally {
            this.currentBlock = undefined;
        }
    }

    public async applyTransaction(transaction: Interfaces.ITransaction): Promise<void> {
        const transactionHandler: Handlers.TransactionHandler = await Handlers.Registry.get(
            transaction.type,
            transaction.typeGroup,
        );

        let lockWallet: State.IWallet;
        let lockTransaction: Interfaces.ITransactionData;
        if (
            transaction.type === Enums.TransactionType.HtlcClaim &&
            transaction.typeGroup === Enums.TransactionTypeGroup.Core
        ) {
            const lockId = transaction.data.asset.claim.lockTransactionId;
            lockWallet = this.findByIndex(State.WalletIndexes.Locks, lockId);
            lockTransaction = lockWallet.getAttribute("htlc.locks", {})[lockId];
        }

        await transactionHandler.apply(transaction, this);

        const sender: State.IWallet = this.findByPublicKey(transaction.data.senderPublicKey);
        const recipient: State.IWallet = this.findByAddress(transaction.data.recipientId);

        const consensus: Consensus.IConsensus = app.resolvePlugin("consensus");
        consensus.addTransaction(sender, recipient, transaction.data, lockWallet, lockTransaction);
    }

    public async revertTransaction(transaction: Interfaces.ITransaction): Promise<void> {
        const { data } = transaction;

        const transactionHandler: TransactionInterfaces.ITransactionHandler = await Handlers.Registry.get(
            transaction.type,
            transaction.typeGroup,
        );
        const sender: State.IWallet = this.findByPublicKey(data.senderPublicKey);
        const recipient: State.IWallet = this.findByAddress(data.recipientId);

        await transactionHandler.revert(transaction, this);

        let lockWallet: State.IWallet;
        let lockTransaction: Interfaces.ITransactionData;
        if (
            transaction.type === Enums.TransactionType.HtlcClaim &&
            transaction.typeGroup === Enums.TransactionTypeGroup.Core
        ) {
            const lockId = transaction.data.asset.claim.lockTransactionId;
            lockWallet = this.findByIndex(State.WalletIndexes.Locks, lockId);
            lockTransaction = lockWallet.getAttribute("htlc.locks", {})[lockId];
        }

        // Revert vote balance updates
        const consensus: Consensus.IConsensus = app.resolvePlugin("consensus");
        consensus.addTransaction(sender, recipient, transaction.data, lockWallet, lockTransaction, true);
    }

    public canBePurged(wallet: State.IWallet): boolean {
        return wallet.canBePurged();
    }

    public reset(): void {
        for (const walletIndex of Object.values(this.indexes)) {
            walletIndex.clear();
        }
    }
}
