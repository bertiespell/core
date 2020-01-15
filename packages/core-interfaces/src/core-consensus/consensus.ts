import { Interfaces } from "@arkecosystem/crypto";
import { IWallet } from "../core-state";

export interface IConsensus {
    initialize(genesis?: boolean): void;
    shutdown(height: number): Promise<void>;
    validateGenerator(block: Interfaces.IBlock): Promise<boolean>;
    addTransaction(
        sender: IWallet,
        recipient: IWallet,
        transaction: Interfaces.ITransactionData,
        lockWallet: IWallet,
        lockTransaction: Interfaces.ITransactionData,
        revert?: boolean,
    ): void;
    loadNextBlock(height: number): Promise<void>;
    verifyBlock(block: Interfaces.IBlockData, startHeight: number): Promise<boolean> 
    applyBlock(height: number): Promise<void>;
    restoreBlock(height: number): Promise<void>;
    revertBlock(block: Interfaces.IBlock): Promise<void>
}