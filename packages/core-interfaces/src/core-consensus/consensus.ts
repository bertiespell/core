import { Interfaces } from "@arkecosystem/crypto";
import { IWallet } from "../core-state";
import { IRoundInfo } from "../shared";

export interface IConsensus {

    getActiveDelegates(
        roundInfo?: IRoundInfo,
        delegates?: IWallet[],
        forgingDelegates?: IWallet[],
    ): Promise<IWallet[]>;

    updateVoteBalances(
        sender: IWallet,
        recipient: IWallet,
        transaction: Interfaces.ITransactionData,
        lockWallet: IWallet,
        lockTransaction: Interfaces.ITransactionData,
        revert?: boolean,
    ): void;

    buildDelegateRanking(roundInfo?: IRoundInfo): IWallet[];
}