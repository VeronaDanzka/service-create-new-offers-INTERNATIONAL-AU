import { sql } from './data/db.js';
import { getAuthHeaders } from './utils/getAuthHeaders.js';
import { priceMarginD, priceMarginX } from './utils/calculatePricing.js';
import { removeIframes } from './utils/removeIframe.js';
import getEbayItems from './getEbayItems.js'
import mappingEbayCategories from './data/mappingEbayCategories.json' with { type: "json" };
import { colorListUS, colorListXUS } from './data/colorLists.js';
import { normalizeWords } from './utils/normalizeWords.js';
import { chunk } from './utils/chunk.js';
import { restrictedBrand, realBrand } from './data/brand.js';
import materialListUS from './data/materials.json' with { type: "json" };
import { addUnderscores } from './utils/addUnderscore.js';


const { 
  SUPPLIER_BASE, 
  SUPPLIER_1, 
  MERCHANTLOCATION_1, 
  MERCHANTLOCATION_2, 
  MARKETPLACE, 
  FX_1,
  FX_2, 
  CURRENCY, 
  LOCALE,
  RETURNPOLICY,
  SHIPPINGPROFILE,
  PAYMENTPOLICY } = process.env;



// function getParentTitle(strings) {
//   if (!strings.length) return '';
//   // On part de la première chaîne
//   const base = strings[0];
//   let result = '';

//   // Pour chaque position i dans base
//   for (let i = 0; i < base.length; i++) {
//     // Et chaque fin j > i
//     for (let j = i + 1; j <= base.length; j++) {
//       const substr = base.slice(i, j);
//       // Ignorer si pas plus long que ce qu'on a déjà
//       if (substr.length <= result.length) continue;
//       // Vérifier que toutes les autres chaînes contiennent substr
//       if (strings.every(s => s.includes(substr))) {
//         result = substr;
//       }
//     }
//   }
// }


async function getCategoryChainForProduct(categoryName) {
  // CTE récursive pour remonter dans la table category
  // en partant de name = categoryName
  const requestCat = `
    WITH RECURSIVE cat_path (id, name, parent_name, depth) AS (
      SELECT id, name, parent_name, 1
        FROM category_${SUPPLIER_BASE}
       WHERE name = $1
      UNION ALL
      SELECT c.id, c.name, c.parent_name, cp.depth + 1
        FROM category_${SUPPLIER_BASE} AS c
        JOIN cat_path             AS cp
          ON c.name = cp.parent_name
    )
    SELECT id, name, parent_name
      FROM cat_path
     ORDER BY depth;
  `;
  const categories = await sql([requestCat], categoryName)

  return { categories };
}
async function createDataItems(newListing, supplier){
  const payloadsInventoryArrayD = []
  const payloadsOffersArrayD = []
  const payloadsInventoryArrayX = []
  const payloadsOffersArrayX = []
  if(supplier === SUPPLIER_BASE){
    for ( const { sku, category_id, weight, dealer_price, stock, brand, ean, color, materials, size, cloud_img } of newListing){
      try {
        if (stock === 0 || restrictedBrand.includes(brand.toUpperCase())){ 
          continue};
        const { categories } = await getCategoryChainForProduct(category_id)
        const translatedCategories = await Promise.all(
            categories.map(async category => {
              const requestCat = `SELECT name, lang
                            FROM category_${SUPPLIER_BASE}_translate
                            WHERE category_name = $1;`;
              const translations = await sql([requestCat],category.name);
              return {
                  translations
              };
            }))
        const requestProduct = `
          SELECT name, description
          FROM products_${SUPPLIER_BASE}_translate
          WHERE sku = $1
            AND lang = 'en';
        `;
        const [row] = await sql([requestProduct], sku);
        if (!row){
          continue; 
        }
        if(!row.name && !row.description){
          continue};
        const translatedName = row.name.length > 80 ? row.name.replace(brand, '') : row.name
        const translatedDescription = removeIframes(row.description)
        const catalogRawPathUS = translatedCategories
            .map(cat => cat.translations.find(t => t.lang === 'en')?.name)
            .filter(Boolean)
            .join(' ');
        const matchEbayCat = mappingEbayCategories.find(data => data.rawPathUS === catalogRawPathUS)
        const requestCat = `SELECT name FROM category_${SUPPLIER_BASE}_translate
                          WHERE category_name = $1
                            AND lang = 'en'`;
        const rowsCats = await sql([requestCat], category_id);
        const categoryUS = rowsCats.length > 0 ? rowsCats[0].name : '';
        if(!categoryUS || !matchEbayCat || !cloud_img){
          continue;}
        const { category_idUS = null, rawPathUS = null, TypeUS = null, BaseUS = null, StyleUS = null, ProduitUS = null } = matchEbayCat
        if(rawPathUS && (rawPathUS.toLowerCase().includes("fashion") || rawPathUS.toLowerCase().includes("lingerie"))){
          continue;}
        if(rawPathUS && (rawPathUS.toLowerCase().includes("realistic") || rawPathUS.toLowerCase().includes("vaginas") || rawPathUS.toLowerCase().includes("inflatable dolls"))){
          continue;}
        if(rawPathUS && (rawPathUS.toLowerCase().includes("assorted items"))){
          continue;}
        let departmentUS = 'Unisex'
        if(rawPathUS.includes(' Men') || rawPathUS.includes(' men')){
          departmentUS = 'Men'
        }
        if(rawPathUS.includes('Women') || rawPathUS.includes('women')){
          departmentUS = 'Women'
        }
        const normalizedName = addUnderscores(translatedName)
        const normalizedDescription = addUnderscores(translatedDescription)
        const normalizedcategoryUS = addUnderscores(categoryUS)
        const normalizedTitle = normalizeWords(normalizedcategoryUS) + ' ' + normalizeWords(normalizedName) + ' +1 surprise gift'
        const title = normalizedTitle.length > 80 ? normalizeWords(normalizedName) : normalizedTitle
        const materialUS = !rawPathUS.toLowerCase().includes("lubricant") ? (materials ?? [])
        .map(m => materialListUS[m])   // valeur ou undefined
        .filter(Boolean) : [];
        let PerfumeNameUS = null
        let VolumeUS = null
        const itemBrand = realBrand.find(b => brand.includes(b)) ?? brand;
        const normalizedBrand = normalizeWords(itemBrand);
        const colorUS = colorListUS[color]
        const quantity = stock > 5 ? 5 : stock
        const skuUS = sku + `-${SUPPLIER_BASE}-CH-WORLD`
        const fabricantGarantyUS = "2 years"
        const cloud_imgUS = cloud_img
        const priceEURn = priceMarginD(dealer_price, weight || 0)
        const priceEUR = priceEURn * Number(FX_1)
        const priceCHF = priceEUR.toFixed(2);
        const returnPolicy = RETURNPOLICY
        const shippingProfile = SHIPPINGPROFILE
        const paymentPolicyId = PAYMENTPOLICY
        cloud_imgUS.push('https://images.xbunnysextoys.com/products/livraison-xbunny.webp')
        
        // contenu du body à envoyer à API eBay pour INVENTORY
        const payloadInventoryUS = 
            {
              availability: {
                shipToLocationAvailability: {
                  availabilityDistributions: [
                    {
                      fulfillmentTime: { unit: 'BUSINESS_DAY', value: 1 },
                      merchantLocationKey: MERCHANTLOCATION_1,
                      quantity: quantity            
                    }
                  ],
                  quantity: quantity
                }
              },
              condition: 'NEW',
              locale: LOCALE,
              product: {
                aspects: {
                  ...(normalizedBrand && { Marke: [normalizedBrand] }),
                  ...(TypeUS  && { Produktart: [TypeUS]  }),
                  ...(colorUS && { Farbe: [colorUS] }),
                  ...(size && { Größe: [size] }),
                  ...(materialUS.length && { Material: materialUS }),
                  ...(departmentUS && { Abteilung: [departmentUS] }),
                  ...(BaseUS && { Basis: [BaseUS]}),
                  ...(PerfumeNameUS && { Parfümname: [PerfumeNameUS]}),
                  ...(VolumeUS && { Inhalt: [VolumeUS]}),
                  ...(fabricantGarantyUS && { Herstellergarantie: [fabricantGarantyUS]})
                },
                ean: [ean],
                imageUrls: cloud_imgUS,
                title: title
              },
              sku: skuUS
            };
        // contenu du body à envoyer à API eBay pour OFFERS
        const payloadOffersUS = 
              {
                categoryId: category_idUS,
                format: "FIXED_PRICE",
                hideBuyerDetails: true,
                includeCatalogProductDetails: true,
                listingDescription: normalizedDescription,
                listingDuration: "GTC",
                listingPolicies: {
                  bestOfferTerms: {
                    bestOfferEnabled: true
                  },
                  eBayPlusIfEligible: false,
                  fulfillmentPolicyId: shippingProfile,
                  paymentPolicyId: paymentPolicyId,
                  returnPolicyId: returnPolicy,
                },
                marketplaceId: MARKETPLACE,
                merchantLocationKey: MERCHANTLOCATION_1,
                pricingSummary: {
                  price: {
                    currency: CURRENCY,
                    value: String(priceCHF)
                  },
                },
                // "regulatory": {
                //   "manufacturer": {
                //     "addressLine1": "string",
                //     "addressLine2": "string",
                //     "city": "string",
                //     "companyName": "string",
                //     "contactUrl": "string",
                //     "country": "CountryCodeEnum : [AD,AE,AF,AG,AI,AL,AM,AN,AO,AQ,AR,AS,AT,AU,AW,AX,AZ,BA,BB,BD,BE,BF,BG,BH,BI,BJ,BL,BM,BN,BO,BQ,BR,BS,BT,BV,BW,BY,BZ,CA,CC,CD,CF,CG,CH,CI,CK,CL,CM,CN,CO,CR,CU,CV,CW,CX,CY,CZ,DE,DJ,DK,DM,DO,DZ,EC,EE,EG,EH,ER,ES,ET,FI,FJ,FK,FM,FO,FR,GA,GB,GD,GE,GF,GG,GH,GI,GL,GM,GN,GP,GQ,GR,GS,GT,GU,GW,GY,HK,HM,HN,HR,HT,HU,ID,IE,IL,IM,IN,IO,IQ,IR,IS,IT,JE,JM,JO,JP,KE,KG,KH,KI,KM,KN,KP,KR,KW,KY,KZ,LA,LB,LC,LI,LK,LR,LS,LT,LU,LV,LY,MA,MC,MD,ME,MF,MG,MH,MK,ML,MM,MN,MO,MP,MQ,MR,MS,MT,MU,MV,MW,MX,MY,MZ,NA,NC,NE,NF,NG,NI,NL,NO,NP,NR,NU,NZ,OM,PA,PE,PF,PG,PH,PK,PL,PM,PN,PR,PS,PT,PW,PY,QA,RE,RO,RS,RU,RW,SA,SB,SC,SD,SE,SG,SH,SI,SJ,SK,SL,SM,SN,SO,SR,ST,SV,SX,SY,SZ,TC,TD,TF,TG,TH,TJ,TK,TL,TM,TN,TO,TR,TT,TV,TW,TZ,UA,UG,UM,US,UY,UZ,VA,VC,VE,VG,VI,VN,VU,WF,WS,YE,YT,ZA,ZM,ZW]",
                //     "email": "string",
                //     "phone": "string",
                //     "postalCode": "string",
                //     "stateOrProvince": "string"
                //   },
                //   "responsiblePersons": [
                //     {
                //       "addressLine1": "string",
                //       "addressLine2": "string",
                //       "city": "string",
                //       "companyName": "string",
                //       "contactUrl": "string",
                //       "country": "CountryCodeEnum : [AD,AE,AF,AG,AI,AL,AM,AN,AO,AQ,AR,AS,AT,AU,AW,AX,AZ,BA,BB,BD,BE,BF,BG,BH,BI,BJ,BL,BM,BN,BO,BQ,BR,BS,BT,BV,BW,BY,BZ,CA,CC,CD,CF,CG,CH,CI,CK,CL,CM,CN,CO,CR,CU,CV,CW,CX,CY,CZ,DE,DJ,DK,DM,DO,DZ,EC,EE,EG,EH,ER,ES,ET,FI,FJ,FK,FM,FO,FR,GA,GB,GD,GE,GF,GG,GH,GI,GL,GM,GN,GP,GQ,GR,GS,GT,GU,GW,GY,HK,HM,HN,HR,HT,HU,ID,IE,IL,IM,IN,IO,IQ,IR,IS,IT,JE,JM,JO,JP,KE,KG,KH,KI,KM,KN,KP,KR,KW,KY,KZ,LA,LB,LC,LI,LK,LR,LS,LT,LU,LV,LY,MA,MC,MD,ME,MF,MG,MH,MK,ML,MM,MN,MO,MP,MQ,MR,MS,MT,MU,MV,MW,MX,MY,MZ,NA,NC,NE,NF,NG,NI,NL,NO,NP,NR,NU,NZ,OM,PA,PE,PF,PG,PH,PK,PL,PM,PN,PR,PS,PT,PW,PY,QA,RE,RO,RS,RU,RW,SA,SB,SC,SD,SE,SG,SH,SI,SJ,SK,SL,SM,SN,SO,SR,ST,SV,SX,SY,SZ,TC,TD,TF,TG,TH,TJ,TK,TL,TM,TN,TO,TR,TT,TV,TW,TZ,UA,UG,UM,US,UY,UZ,VA,VC,VE,VG,VI,VN,VU,WF,WS,YE,YT,ZA,ZM,ZW]",
                //       "email": "string",
                //       "phone": "string",
                //       "postalCode": "string",
                //       "stateOrProvince": "string",
                //       "types": [
                //         "ResponsiblePersonTypeEnum"
                //       ]
                //     }
                //   ]
                // },
                sku: skuUS
              };
        payloadsInventoryArrayD.push(payloadInventoryUS)
        payloadsOffersArrayD.push(payloadOffersUS)
      } catch (error) {
        console.error(`Error processing SKU ${sku}:`, error);
        continue; // Passe au prochain élément en cas d'erreur
      }
    }
    return { payloadsInventoryArrayD, payloadsOffersArrayD }
  }
  if(supplier === SUPPLIER_1){
    for ( const { sku, category_id, weight, dealer_price, stock, brand, ean, color, materials, length, insertable, diameter, circumference, gender, liquidvolumn, size, cloud_img } of newListing){
      try {
        if (stock === 0 || !brand || restrictedBrand.includes(brand.toUpperCase())){
          continue;
        };
        const { categories } = await getCategoryChainForProduct(category_id)
        const translatedCategories = await Promise.all(
            categories.map(async category => {
              const requestCat = `SELECT name, lang
                            FROM category_${SUPPLIER_BASE}_translate
                            WHERE category_name = $1;`;
              const translations = await sql([requestCat], category.name);
              return {
                  translations
              };
            }))
        const requestProduct = `
          SELECT name, description
          FROM products_${SUPPLIER_1}
          WHERE sku = $1
        `;
        const [row] = await sql([requestProduct], sku);
        if (!row || !row.name || !row.description){
          continue;
        } 
        const translatedName = row.name.length > 80 ? row.name.replace(brand, '') : row.name
        const translatedDescription = removeIframes(row.description)
        const dimensions = [
          { label: 'Length', value: length },
          { label: 'Insertable Length', value: insertable },
          { label: 'Diameter', value: diameter },
          { label: 'Circumference', value: circumference }
        ];

        const descriptionDimensions = dimensions
          .filter(d => d.value)
          .map(d => `<p>${d.label} : ${d.value}</p>`)
          .join('');
        const fullDescription = translatedDescription + descriptionDimensions;
        const catalogRawPathUS = translatedCategories 
            .map(cat => cat.translations.find(t => t.lang === 'en')?.name)
            .filter(Boolean)
            .join(' ');
        const matchEbayCat = mappingEbayCategories.find(data => data.rawPathUS === catalogRawPathUS)
        const requestCat = `SELECT name FROM category_${SUPPLIER_BASE}_translate
                          WHERE category_name = $1
                            AND lang = 'en'`;
        const rowsCats = await sql([requestCat], category_id);
        const categoryUS = rowsCats.length > 0 ? rowsCats[0].name : '';
        if(!categoryUS || !matchEbayCat || !cloud_img) continue;
        const { category_idUS = null, rawPathUS = null, TypeUS = null, BaseUS = null, StyleUS = null, ProduitUS = null } = matchEbayCat
        if(rawPathUS && (rawPathUS.toLowerCase().includes("fashion") || rawPathUS.toLowerCase().includes("lingerie"))){
          continue;}
        if(rawPathUS && (rawPathUS.toLowerCase().includes("realistic") || rawPathUS.toLowerCase().includes("vaginas") || rawPathUS.toLowerCase().includes("inflatable dolls"))){
          continue;}
        if(rawPathUS && (rawPathUS.toLowerCase().includes("assorted items"))){
          continue;}
        let departmentUS = 'Unisex'
        if(rawPathUS.includes(' Men') || rawPathUS.includes(' men')){
          departmentUS = 'Men'
        }
        if(rawPathUS.includes('Women') || rawPathUS.includes('women')){
          departmentUS = 'Women'
        }
        const normalizedName = addUnderscores(translatedName)
        const normalizedDescription = addUnderscores(fullDescription)
        const normalizedcategoryUS = addUnderscores(categoryUS)
        const normalizedTitle = normalizeWords(normalizedcategoryUS) + ' ' + normalizeWords(translatedName) + ' +1 surprise gift'
        const title = normalizedTitle.length > 80 ? normalizeWords(normalizedName) : normalizedTitle
        const materialArray = Array.isArray(materials)
          ? materials
          : (materials ? [materials] : []);
        const materialUS = !rawPathUS.toLowerCase().includes("lubrifiant") ? (materialArray ?? [])
        .map(m => materialListUS[m])   // valeur ou undefined
        .filter(Boolean) : [];
        let PerfumeNameUS = null
        let VolumeUS = null
        if( liquidvolumn ){ VolumeUS = liquidvolumn }
        const itemBrand = realBrand.find(b => brand.includes(b)) ?? brand;
        const normalizedBrand = normalizeWords(itemBrand);
        const colorUS = colorListXUS[color]
        const quantity = stock > 5 ? 5 : stock
        const skuUS = sku + `-${SUPPLIER_1}-CH-WORLD`
        const fabricantGarantyUS = "2 years"
        const cloud_imgUS = cloud_img
        const dealerTVA = Number(dealer_price) / 1.20
        const priceGBP = priceMarginX(dealerTVA, weight)
        const priceCHF = (priceGBP * Number(FX_2)).toFixed(2);
        const returnPolicy = RETURNPOLICY
        const shippingProfile = SHIPPINGPROFILE
        const paymentPolicyId = PAYMENTPOLICY
        cloud_imgUS.push('https://images.xbunnysextoys.com/products/livraison-xbunny.webp')
        const payloadInventoryUS = 
            {
              availability: {
                shipToLocationAvailability: {
                  availabilityDistributions: [
                    {
                      fulfillmentTime: { unit: 'BUSINESS_DAY', value: 1 },
                      merchantLocationKey: MERCHANTLOCATION_2,
                      quantity: quantity            
                    }
                  ],
                  quantity: quantity
                }
              },
              condition: 'NEW',
              locale: LOCALE,
              product: {
                aspects: {
                  ...(normalizedBrand && { Marke: [normalizedBrand] }),
                  ...(TypeUS  && { Produktart: [TypeUS]  }),
                  ...(colorUS && { Farbe: [colorUS] }),
                  ...(size && { Größe: [size] }),
                  ...(materialUS.length && { Material: materialUS }),
                  ...(departmentUS && { Abteilung: [departmentUS] }),
                  ...(BaseUS && { Basis: [BaseUS]}),
                  ...(PerfumeNameUS && { Parfümname: [PerfumeNameUS]}),
                  ...(VolumeUS && { Inhalt: [VolumeUS]}),
                  ...(fabricantGarantyUS && { Herstellergarantie: [fabricantGarantyUS]})
                },
                ean: [ean],
                imageUrls: cloud_imgUS,
                title: title
              },
              sku: skuUS
            };
        const payloadOffersUS = 
              {
                categoryId: category_idUS,
                format: "FIXED_PRICE",
                hideBuyerDetails: true,
                includeCatalogProductDetails: true,
                listingDescription: normalizedDescription,
                listingDuration: "GTC",
                listingPolicies: {
                  bestOfferTerms: {
                    bestOfferEnabled: true
                  },
                  eBayPlusIfEligible: false,
                  fulfillmentPolicyId: shippingProfile,
                  paymentPolicyId: paymentPolicyId,
                  returnPolicyId: returnPolicy,
                },
                marketplaceId: MARKETPLACE,
                merchantLocationKey: MERCHANTLOCATION_2,
                pricingSummary: {
                  price: {
                    currency: CURRENCY,
                    value: String(priceCHF)
                  },
                },
                // "regulatory": {
                //   "manufacturer": {
                //     "addressLine1": "string",
                //     "addressLine2": "string",
                //     "city": "string",
                //     "companyName": "string",
                //     "contactUrl": "string",
                //     "country": "CountryCodeEnum : [AD,AE,AF,AG,AI,AL,AM,AN,AO,AQ,AR,AS,AT,AU,AW,AX,AZ,BA,BB,BD,BE,BF,BG,BH,BI,BJ,BL,BM,BN,BO,BQ,BR,BS,BT,BV,BW,BY,BZ,CA,CC,CD,CF,CG,CH,CI,CK,CL,CM,CN,CO,CR,CU,CV,CW,CX,CY,CZ,DE,DJ,DK,DM,DO,DZ,EC,EE,EG,EH,ER,ES,ET,FI,FJ,FK,FM,FO,FR,GA,GB,GD,GE,GF,GG,GH,GI,GL,GM,GN,GP,GQ,GR,GS,GT,GU,GW,GY,HK,HM,HN,HR,HT,HU,ID,IE,IL,IM,IN,IO,IQ,IR,IS,IT,JE,JM,JO,JP,KE,KG,KH,KI,KM,KN,KP,KR,KW,KY,KZ,LA,LB,LC,LI,LK,LR,LS,LT,LU,LV,LY,MA,MC,MD,ME,MF,MG,MH,MK,ML,MM,MN,MO,MP,MQ,MR,MS,MT,MU,MV,MW,MX,MY,MZ,NA,NC,NE,NF,NG,NI,NL,NO,NP,NR,NU,NZ,OM,PA,PE,PF,PG,PH,PK,PL,PM,PN,PR,PS,PT,PW,PY,QA,RE,RO,RS,RU,RW,SA,SB,SC,SD,SE,SG,SH,SI,SJ,SK,SL,SM,SN,SO,SR,ST,SV,SX,SY,SZ,TC,TD,TF,TG,TH,TJ,TK,TL,TM,TN,TO,TR,TT,TV,TW,TZ,UA,UG,UM,US,UY,UZ,VA,VC,VE,VG,VI,VN,VU,WF,WS,YE,YT,ZA,ZM,ZW]",
                //     "email": "string",
                //     "phone": "string",
                //     "postalCode": "string",
                //     "stateOrProvince": "string"
                //   },
                //   "responsiblePersons": [
                //     {
                //       "addressLine1": "string",
                //       "addressLine2": "string",
                //       "city": "string",
                //       "companyName": "string",
                //       "contactUrl": "string",
                //       "country": "CountryCodeEnum : [AD,AE,AF,AG,AI,AL,AM,AN,AO,AQ,AR,AS,AT,AU,AW,AX,AZ,BA,BB,BD,BE,BF,BG,BH,BI,BJ,BL,BM,BN,BO,BQ,BR,BS,BT,BV,BW,BY,BZ,CA,CC,CD,CF,CG,CH,CI,CK,CL,CM,CN,CO,CR,CU,CV,CW,CX,CY,CZ,DE,DJ,DK,DM,DO,DZ,EC,EE,EG,EH,ER,ES,ET,FI,FJ,FK,FM,FO,FR,GA,GB,GD,GE,GF,GG,GH,GI,GL,GM,GN,GP,GQ,GR,GS,GT,GU,GW,GY,HK,HM,HN,HR,HT,HU,ID,IE,IL,IM,IN,IO,IQ,IR,IS,IT,JE,JM,JO,JP,KE,KG,KH,KI,KM,KN,KP,KR,KW,KY,KZ,LA,LB,LC,LI,LK,LR,LS,LT,LU,LV,LY,MA,MC,MD,ME,MF,MG,MH,MK,ML,MM,MN,MO,MP,MQ,MR,MS,MT,MU,MV,MW,MX,MY,MZ,NA,NC,NE,NF,NG,NI,NL,NO,NP,NR,NU,NZ,OM,PA,PE,PF,PG,PH,PK,PL,PM,PN,PR,PS,PT,PW,PY,QA,RE,RO,RS,RU,RW,SA,SB,SC,SD,SE,SG,SH,SI,SJ,SK,SL,SM,SN,SO,SR,ST,SV,SX,SY,SZ,TC,TD,TF,TG,TH,TJ,TK,TL,TM,TN,TO,TR,TT,TV,TW,TZ,UA,UG,UM,US,UY,UZ,VA,VC,VE,VG,VI,VN,VU,WF,WS,YE,YT,ZA,ZM,ZW]",
                //       "email": "string",
                //       "phone": "string",
                //       "postalCode": "string",
                //       "stateOrProvince": "string",
                //       "types": [
                //         "ResponsiblePersonTypeEnum"
                //       ]
                //     }
                //   ]
                // },
                sku: skuUS
              };
        payloadsInventoryArrayX.push(payloadInventoryUS)
        payloadsOffersArrayX.push(payloadOffersUS)
      } catch (error) {
        console.error(`Error processing SKU ${sku}:`, error);
        continue; // Passe au prochain élément en cas d'erreur
      }
    }
    return { payloadsInventoryArrayX, payloadsOffersArrayX }
  }
}



async function createNewItems() {
  /* ------------------------------------------------------------------ */
  /* 1) calcul des nouveaux listings                                    */
  /* ------------------------------------------------------------------ */
  const items = await getEbayItems();
  const suppD_sku = `-${SUPPLIER_BASE}-CH-WORLD`
  const suppX_sku = `-${SUPPLIER_1}-CH-WORLD`
  const normalizeSkuFRD = sku => sku.replace(suppD_sku, '');
  const normalizeSkuFRX = sku => sku.replace(suppX_sku, '');
  const tableD = `products_${SUPPLIER_BASE}`;
  const tableX = `products_${SUPPLIER_1}`;
  const catalogItemsD   = await sql([`SELECT * FROM ${tableD}`]);
  const catalogItemsX   = await sql([`SELECT * FROM ${tableX}`]);
  const newListingD     = catalogItemsD.filter(
    item => !items.some(i => normalizeSkuFRD(i.sku) === item.sku)
  );
  const newListingX     = catalogItemsX.filter(
    item => !items.some(i => normalizeSkuFRX(i.sku) === item.sku)
  );
  console.log(`Nouveaux produits à créer pour ${SUPPLIER_BASE} : `, newListingD.length);
  console.log(`Nouveaux produits à créer pour ${SUPPLIER_1} : `, newListingX.length);
  const { payloadsInventoryArrayD, payloadsOffersArrayD } =
    await createDataItems(newListingD, SUPPLIER_BASE);
  const { payloadsInventoryArrayX, payloadsOffersArrayX } =
    await createDataItems(newListingX, SUPPLIER_1);
  console.log(`Payloads INVENTORY à créer pour ${SUPPLIER_BASE} : `, payloadsInventoryArrayD.length);
  console.log(`Payloads OFFERS à créer pour ${SUPPLIER_BASE} : `, payloadsOffersArrayD.length);
  console.log(`Payloads INVENTORY à créer pour ${SUPPLIER_1} : `, payloadsInventoryArrayX.length);
  console.log(`Payloads OFFERS à créer pour ${SUPPLIER_1} : `, payloadsOffersArrayX.length);

  // Limites
  const LIMIT_D = 1660;
  const LIMIT_X = 830;

  // INVENTORY
  const limitedInventoryD = payloadsInventoryArrayD.slice(0, LIMIT_D);
  const limitedInventoryX = payloadsInventoryArrayX.slice(0, LIMIT_X);

  const payloadsFullInventory = [
    ...limitedInventoryD,
    ...limitedInventoryX
  ];

  // OFFERS
  const limitedOffersD = payloadsOffersArrayD.slice(0, LIMIT_D);
  const limitedOffersX = payloadsOffersArrayX.slice(0, LIMIT_X);

  const payloadsFullOffers = [
    ...limitedOffersD,
    ...limitedOffersX
  ];
  /* ------------------------------------------------------------------ */
  /* 2) envoi des paquets de 25                                          */
  /* ------------------------------------------------------------------ */
  const headers = await getAuthHeaders();
  headers['X-eBay-C-Marketplace-Id'] = MARKETPLACE;
  const inventoryChunks = chunk(payloadsFullInventory, 25);
  const offerChunks     = chunk(payloadsFullOffers,     25);

  const inventoryResults = [];
  const offerResults     = [];

  // --- en série pour ne pas exploser les rate-limits
  for (const body of inventoryChunks) {
    const r = await fetch(
      'https://api.ebay.com/sell/inventory/v1/bulk_create_or_replace_inventory_item',
      { method: 'POST', headers, body: JSON.stringify({ requests: body }) }
    );
    inventoryResults.push(await r.json());
  }

  for (const body of offerChunks) {
    const r = await fetch(
      'https://api.ebay.com/sell/inventory/v1/bulk_create_offer',
      { method: 'POST', headers, body: JSON.stringify({ requests: body }) }
    );
    offerResults.push(await r.json());
  }

  /* ------------------------------------------------------------------ */
  /* 3) retour global                                                   */
  /* ------------------------------------------------------------------ */
  return {
    inventory: inventoryResults,   // tableau de réponses (une par lot)
    offers:    offerResults
  };
}

export default createNewItems;