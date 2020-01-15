import { app } from "@arkecosystem/core-container";
import { Blockchain, EventEmitter, Logger, P2P, TransactionPool } from "@arkecosystem/core-interfaces";
import { isWhitelisted } from "@arkecosystem/core-utils";
import { process } from "ipaddr.js";

export const acceptNewPeer = async ({ service, req }: { service: P2P.IPeerService; req }): Promise<void> => {
    await service.getProcessor().validateAndAcceptPeer({ ip: req.data.ip });
};

export const isPeerOrForger = ({ service, req }: { service: P2P.IPeerService; req }): { isPeerOrForger: boolean } => {
    const sanitizedIp = process(req.data.ip).toString();
    return {
        isPeerOrForger:
            service.getStorage().hasPeer(sanitizedIp) ||
            isWhitelisted(app.resolveOptions("p2p").remoteAccess, sanitizedIp),
    };
};

export const emitEvent = ({ req }): void => {
    app.resolvePlugin<EventEmitter.EventEmitter>("event-emitter").emit(req.data.event, req.data.body);
};

export const getUnconfirmedTransactions = async (): Promise<P2P.IUnconfirmedTransactions> => {
    const blockchain = app.resolvePlugin<Blockchain.IBlockchain>("blockchain");
    const { maxTransactions } = app.getConfig().getMilestone(blockchain.getLastBlock().data.height).block;

    const transactionPool: TransactionPool.IConnection = app.resolvePlugin<TransactionPool.IConnection>(
        "transaction-pool",
    );

    return {
        transactions: await transactionPool.getTransactionsForForging(maxTransactions),
        poolSize: await transactionPool.getPoolSize(),
    };
};

export const getNetworkState = async ({ service }: { service: P2P.IPeerService }): Promise<P2P.INetworkState> => {
    return service.getMonitor().getNetworkState();
};

export const getRateLimitStatus = async ({
    service,
    req,
}: {
    service: P2P.IPeerService;
    req: { data: { ip: string; endpoint?: string } };
}): Promise<P2P.IRateLimitStatus> => {
    return service.getMonitor().getRateLimitStatus(req.data.ip, req.data.endpoint);
};

export const isBlockedByRateLimit = async ({
    service,
    req,
}: {
    service: P2P.IPeerService;
    req: { data: { ip: string } };
}): Promise<{ blocked: boolean }> => {
    return {
        blocked: await service.getMonitor().isBlockedByRateLimit(req.data.ip),
    };
};

export const syncBlockchain = (): void => {
    app.resolvePlugin<Logger.ILogger>("logger").debug("Blockchain sync check WAKEUP requested by forger");

    app.resolvePlugin<Blockchain.IBlockchain>("blockchain").forceWakeup();
};
