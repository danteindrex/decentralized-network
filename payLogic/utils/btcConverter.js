// convert bitcoin ammounts to satoshis
export const btctosatoshi = (btc) => {
    return btc * 100000000; // 1 BTC = 100,000,000 Satoshis
}