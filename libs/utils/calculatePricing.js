// ---------- config calculate shipping pricing Dreamlove & Xtrader by weight ------------
const deliveryD = 24.62;
const delivery500D = 24.62;
const delivery1000D = 24.62;
const delivery2000D = 48.13;
const delivery5000D = 64.39;

const deliveryX = 24.63;
const delivery500X = 24.63;
const delivery1000X = 24.63;
const delivery1760X = 24.63;
const delivery3000X = 48.13;
const delivery5000X = 64.39; 

// ---------- config % ------------
const taxes = 0.23
const ebayFees = 0.1535
const ebayAds = 0.15

const marginBenefit = 0.073

//--------------utils ---------------
export function priceMarginD(dealerPrice, weight){
  if(weight >= 0 && weight <= 500){
    const price = (Number(dealerPrice) + deliveryD) / ( 1 - (taxes + ebayFees + ebayAds) - marginBenefit);
    return price;
  }
  else if (weight > 500 && weight <= 1000) {
    const price = (Number(dealerPrice) + delivery500D) / ( 1 - (taxes + ebayFees + ebayAds) - marginBenefit);
    return price;
  }
  else if (weight > 1000 && weight <= 2000) {
    const price = (Number(dealerPrice) + delivery1000D) / ( 1 - (taxes + ebayFees + ebayAds) - marginBenefit);
    return price;
  }
  else if (weight > 2000 && weight <= 5000) {
    const price = (Number(dealerPrice) + delivery2000D) / ( 1 - (taxes + ebayFees + ebayAds) - marginBenefit);
    return price;
  }
  else if (weight > 5000) {
    const price = (Number(dealerPrice) + delivery5000D) / ( 1 - (taxes + ebayFees + ebayAds) - marginBenefit);
    return price;
  }
}

export function priceMarginX(dealerPrice, weight){
  const weightC = weight ? weight * 1000 : 0; // Convert kg to grams
  if(weightC >= 0 && weightC <= 500){
    const price = (Number(dealerPrice) + deliveryX) / ( 1 - (taxes + ebayFees + ebayAds) - marginBenefit);
    return price;
  }
  else if (weightC > 500 && weightC <= 1000) {
    const price = (Number(dealerPrice) + delivery500X) / ( 1 - (taxes + ebayFees + ebayAds) - marginBenefit);
    return price;
  }
  else if (weightC > 1000 && weightC <= 2000) {
    const price = (Number(dealerPrice) + delivery1000X) / ( 1 - (taxes + ebayFees + ebayAds) - marginBenefit);
    return price;
  }
  else if (weightC > 2000 && weightC <= 5000) {
    const price = (Number(dealerPrice) + delivery1760X) / ( 1 - (taxes + ebayFees + ebayAds) - marginBenefit);
    return price;
  }
  else if (weightC > 3000) {
    const price = (Number(dealerPrice) + delivery3000X) / ( 1 - (taxes + ebayFees + ebayAds) - marginBenefit);
    return price;
  }
  else if (weightC > 5000) {
    const price = (Number(dealerPrice) + delivery5000X) / ( 1 - (taxes + ebayFees + ebayAds) - marginBenefit);
    return price;
  }
}

