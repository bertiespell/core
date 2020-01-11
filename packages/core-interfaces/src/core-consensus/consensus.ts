import { Interfaces } from "@arkecosystem/crypto";
import { IWallet } from "../core-state";
import { IRoundInfo } from "../shared";

export interface IConsensus {

    forgingDelegates: IWallet[];

    getActiveDelegates(
        roundInfo?: IRoundInfo,
        delegates?: IWallet[],
    ): Promise<IWallet[]>;

    updateVoteBalances(
        sender: IWallet,
        recipient: IWallet,
        transaction: Interfaces.ITransactionData,
        lockWallet: IWallet,
        lockTransaction: Interfaces.ITransactionData,
        revert?: boolean,
    ): void;

    updateDelegates(roundInfo?: IRoundInfo): Promise<IWallet[]>;

    initializeActiveDelegates(roundInfo): void;

    updateForgingDelegatesOfRound(roundInfo: IRoundInfo, blocks: Interfaces.IBlock[]): Promise<void>;

    buildVoteBalances(): void;

    buildDelegateRanking(roundInfo?: IRoundInfo): IWallet[];
}