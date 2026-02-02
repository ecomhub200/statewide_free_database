#!/usr/bin/env node

/**
 * Road Data Generator for CRASH LENS
 *
 * This script fetches road data from Overpass API for all Virginia jurisdictions
 * and saves them as static JSON files for instant loading.
 *
 * Usage:
 *   node scripts/generate-road-data.js                    # Generate all jurisdictions
 *   node scripts/generate-road-data.js henrico fairfax   # Generate specific jurisdictions
 *
 * Output:
 *   - data/roads/{jurisdiction}.json files
 *   - Updated data/manifest.json
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
    overpassServers: [
        'https://overpass-api.de/api/interpreter',
        'https://overpass.kumi.systems/api/interpreter',
        'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
    ],
    timeout: 120000, // 2 minutes
    retryDelay: 5000, // 5 seconds between retries
    maxRetries: 3,
    delayBetweenJurisdictions: 10000 // 10 seconds to avoid rate limiting
};

// OSM to VDOT Functional Class mapping
const OSM_TO_VDOT = {
    'motorway': '1', 'motorway_link': '1',
    'trunk': '2', 'trunk_link': '2',
    'primary': '3', 'primary_link': '3',
    'secondary': '4', 'secondary_link': '4',
    'tertiary': '5', 'tertiary_link': '5',
    'unclassified': '6',
    'residential': '7', 'living_street': '7', 'service': '7'
};

// Virginia Jurisdictions (same as in index.html)
const JURISDICTIONS = {
    // Counties (95)
    accomack: { name: "Accomack County", type: "county", fips: "001", center: [37.76, -75.66], zoom: 10, bbox: [-76.0533, 37.2918, -75.2429, 38.0274] },
    albemarle: { name: "Albemarle County", type: "county", fips: "003", center: [38.02, -78.56], zoom: 10, bbox: [-78.8399, 37.7273, -78.2637, 38.3034] },
    alleghany: { name: "Alleghany County", type: "county", fips: "005", center: [37.79, -79.95], zoom: 10, bbox: [-80.2213, 37.5672, -79.6473, 38.0134] },
    amelia: { name: "Amelia County", type: "county", fips: "007", center: [37.34, -77.98], zoom: 10, bbox: [-78.1777, 37.1458, -77.6553, 37.4678] },
    amherst: { name: "Amherst County", type: "county", fips: "009", center: [37.6, -79.14], zoom: 10, bbox: [-79.4745, 37.3962, -78.8591, 37.806] },
    appomattox: { name: "Appomattox County", type: "county", fips: "011", center: [37.37, -78.81], zoom: 10, bbox: [-79.0929, 37.2061, -78.5716, 37.5494] },
    arlington: { name: "Arlington County", type: "county", fips: "013", center: [38.88, -77.1], zoom: 12, bbox: [-77.1722, 38.8275, -77.032, 38.9341] },
    augusta: { name: "Augusta County", type: "county", fips: "015", center: [38.16, -79.13], zoom: 10, bbox: [-79.5431, 37.8873, -78.8617, 38.4767] },
    bath: { name: "Bath County", type: "county", fips: "017", center: [38.07, -79.73], zoom: 10, bbox: [-80.0564, 37.8573, -79.4479, 38.3947] },
    bedford_county: { name: "Bedford County", type: "county", fips: "019", center: [37.31, -79.52], zoom: 10, bbox: [-79.7888, 37.0341, -79.2507, 37.513] },
    bland: { name: "Bland County", type: "county", fips: "021", center: [37.1, -81.12], zoom: 10, bbox: [-81.3447, 36.9649, -80.8546, 37.2462] },
    botetourt: { name: "Botetourt County", type: "county", fips: "023", center: [37.55, -79.81], zoom: 10, bbox: [-80.074, 37.2847, -79.498, 37.8013] },
    brunswick: { name: "Brunswick County", type: "county", fips: "025", center: [36.76, -77.85], zoom: 10, bbox: [-78.0036, 36.5438, -77.6547, 37.0218] },
    buchanan: { name: "Buchanan County", type: "county", fips: "027", center: [37.27, -82.03], zoom: 10, bbox: [-82.3147, 37.0072, -81.7389, 37.5068] },
    buckingham: { name: "Buckingham County", type: "county", fips: "029", center: [37.56, -78.55], zoom: 10, bbox: [-78.8687, 37.3307, -78.2399, 37.7899] },
    campbell: { name: "Campbell County", type: "county", fips: "031", center: [37.21, -79.09], zoom: 10, bbox: [-79.4414, 37.0077, -78.8217, 37.4283] },
    caroline: { name: "Caroline County", type: "county", fips: "033", center: [38.03, -77.35], zoom: 10, bbox: [-77.6434, 37.7881, -77.0312, 38.3047] },
    carroll: { name: "Carroll County", type: "county", fips: "035", center: [36.73, -80.73], zoom: 10, bbox: [-80.9614, 36.5509, -80.4605, 36.9522] },
    charles_city: { name: "Charles City County", type: "county", fips: "036", center: [37.36, -77.06], zoom: 11, bbox: [-77.2495, 37.2423, -76.854, 37.4893] },
    charlotte: { name: "Charlotte County", type: "county", fips: "037", center: [37.01, -78.66], zoom: 10, bbox: [-78.9045, 36.7897, -78.3936, 37.2263] },
    chesterfield: { name: "Chesterfield County", type: "county", fips: "041", center: [37.38, -77.58], zoom: 10, bbox: [-77.8574, 37.1466, -77.3884, 37.5576] },
    clarke: { name: "Clarke County", type: "county", fips: "043", center: [39.11, -77.99], zoom: 11, bbox: [-78.1322, 39.0067, -77.8228, 39.2255] },
    craig: { name: "Craig County", type: "county", fips: "045", center: [37.47, -80.23], zoom: 10, bbox: [-80.4642, 37.2579, -79.9612, 37.6582] },
    culpeper: { name: "Culpeper County", type: "county", fips: "047", center: [38.49, -77.96], zoom: 10, bbox: [-78.2318, 38.2676, -77.6279, 38.7183] },
    cumberland: { name: "Cumberland County", type: "county", fips: "049", center: [37.51, -78.24], zoom: 10, bbox: [-78.4626, 37.3363, -78.0246, 37.6858] },
    dickenson: { name: "Dickenson County", type: "county", fips: "051", center: [37.13, -82.35], zoom: 10, bbox: [-82.5652, 37.0014, -82.0959, 37.2964] },
    dinwiddie: { name: "Dinwiddie County", type: "county", fips: "053", center: [37.08, -77.63], zoom: 10, bbox: [-77.9005, 36.8499, -77.3989, 37.3384] },
    essex: { name: "Essex County", type: "county", fips: "057", center: [37.94, -76.94], zoom: 10, bbox: [-77.1683, 37.7905, -76.6647, 38.1196] },
    fairfax: { name: "Fairfax County", type: "county", fips: "059", center: [38.85, -77.28], zoom: 10, bbox: [-77.5116, 38.5958, -77.0285, 39.0007] },
    fauquier: { name: "Fauquier County", type: "county", fips: "061", center: [38.72, -77.81], zoom: 10, bbox: [-78.0938, 38.4617, -77.5319, 38.9658] },
    floyd: { name: "Floyd County", type: "county", fips: "063", center: [36.93, -80.35], zoom: 10, bbox: [-80.5925, 36.7478, -80.0815, 37.0775] },
    fluvanna: { name: "Fluvanna County", type: "county", fips: "065", center: [37.84, -78.28], zoom: 10, bbox: [-78.5136, 37.6845, -78.0669, 38.0218] },
    franklin_county: { name: "Franklin County", type: "county", fips: "067", center: [36.99, -79.88], zoom: 10, bbox: [-80.1616, 36.7148, -79.5909, 37.2254] },
    frederick: { name: "Frederick County", type: "county", fips: "069", center: [39.2, -78.26], zoom: 10, bbox: [-78.5085, 39.0206, -78.0035, 39.3999] },
    giles: { name: "Giles County", type: "county", fips: "071", center: [37.32, -80.7], zoom: 10, bbox: [-80.9141, 37.1183, -80.4357, 37.5119] },
    gloucester: { name: "Gloucester County", type: "county", fips: "073", center: [37.41, -76.52], zoom: 10, bbox: [-76.7463, 37.2188, -76.2868, 37.5724] },
    goochland: { name: "Goochland County", type: "county", fips: "075", center: [37.72, -77.93], zoom: 10, bbox: [-78.1553, 37.5408, -77.6556, 37.8954] },
    grayson: { name: "Grayson County", type: "county", fips: "077", center: [36.66, -81.22], zoom: 10, bbox: [-81.5347, 36.5052, -80.9005, 36.8514] },
    greene: { name: "Greene County", type: "county", fips: "079", center: [38.3, -78.46], zoom: 11, bbox: [-78.6612, 38.1768, -78.2848, 38.4378] },
    greensville: { name: "Greensville County", type: "county", fips: "081", center: [36.68, -77.56], zoom: 10, bbox: [-77.7674, 36.5429, -77.2977, 36.8753] },
    halifax: { name: "Halifax County", type: "county", fips: "083", center: [36.77, -78.93], zoom: 10, bbox: [-79.2508, 36.5414, -78.6494, 37.0303] },
    hanover: { name: "Hanover County", type: "county", fips: "085", center: [37.76, -77.48], zoom: 10, bbox: [-77.7014, 37.5378, -77.1905, 38.0153] },
    henrico: { name: "Henrico County", type: "county", fips: "087", center: [37.55, -77.45], zoom: 11, bbox: [-77.6604, 37.3862, -77.1462, 37.7234] },
    henry: { name: "Henry County", type: "county", fips: "089", center: [36.68, -79.87], zoom: 10, bbox: [-80.0933, 36.5413, -79.6401, 36.8533] },
    highland: { name: "Highland County", type: "county", fips: "091", center: [38.36, -79.56], zoom: 10, bbox: [-79.8512, 38.1312, -79.2263, 38.5941] },
    isle_of_wight: { name: "Isle of Wight County", type: "county", fips: "093", center: [36.9, -76.71], zoom: 10, bbox: [-76.9259, 36.7127, -76.4226, 37.0703] },
    james_city: { name: "James City County", type: "county", fips: "095", center: [37.31, -76.78], zoom: 11, bbox: [-76.9275, 37.1767, -76.5866, 37.4387] },
    king_and_queen: { name: "King and Queen County", type: "county", fips: "097", center: [37.72, -76.88], zoom: 10, bbox: [-77.1485, 37.5269, -76.609, 37.9212] },
    king_george: { name: "King George County", type: "county", fips: "099", center: [38.27, -77.16], zoom: 10, bbox: [-77.3273, 38.1263, -76.9889, 38.4341] },
    king_william: { name: "King William County", type: "county", fips: "101", center: [37.69, -77.08], zoom: 10, bbox: [-77.3055, 37.5041, -76.8221, 37.8945] },
    lancaster: { name: "Lancaster County", type: "county", fips: "103", center: [37.71, -76.45], zoom: 11, bbox: [-76.6168, 37.5731, -76.2605, 37.8907] },
    lee: { name: "Lee County", type: "county", fips: "105", center: [36.71, -83.13], zoom: 10, bbox: [-83.4724, 36.5007, -82.8487, 36.9299] },
    loudoun: { name: "Loudoun County", type: "county", fips: "107", center: [39.08, -77.64], zoom: 10, bbox: [-77.9623, 38.8426, -77.3243, 39.3222] },
    louisa: { name: "Louisa County", type: "county", fips: "109", center: [38.02, -77.96], zoom: 10, bbox: [-78.2065, 37.8116, -77.6577, 38.2206] },
    lunenburg: { name: "Lunenburg County", type: "county", fips: "111", center: [36.95, -78.24], zoom: 10, bbox: [-78.5038, 36.7645, -78.0033, 37.1458] },
    madison: { name: "Madison County", type: "county", fips: "113", center: [38.41, -78.26], zoom: 10, bbox: [-78.4847, 38.2174, -78.0909, 38.5894] },
    mathews: { name: "Mathews County", type: "county", fips: "115", center: [37.44, -76.32], zoom: 11, bbox: [-76.4639, 37.2954, -76.1497, 37.5502] },
    mecklenburg: { name: "Mecklenburg County", type: "county", fips: "117", center: [36.68, -78.36], zoom: 10, bbox: [-78.6494, 36.5006, -78.0033, 36.9117] },
    middlesex: { name: "Middlesex County", type: "county", fips: "119", center: [37.61, -76.53], zoom: 10, bbox: [-76.7389, 37.4472, -76.2873, 37.7677] },
    montgomery: { name: "Montgomery County", type: "county", fips: "121", center: [37.17, -80.39], zoom: 10, bbox: [-80.6632, 36.9993, -80.1539, 37.3817] },
    nelson: { name: "Nelson County", type: "county", fips: "125", center: [37.79, -78.88], zoom: 10, bbox: [-79.1728, 37.5545, -78.6451, 38.0228] },
    new_kent: { name: "New Kent County", type: "county", fips: "127", center: [37.52, -76.98], zoom: 10, bbox: [-77.1857, 37.3514, -76.7696, 37.6717] },
    northampton: { name: "Northampton County", type: "county", fips: "131", center: [37.3, -75.93], zoom: 10, bbox: [-76.1329, 37.0697, -75.7194, 37.545] },
    northumberland: { name: "Northumberland County", type: "county", fips: "133", center: [37.87, -76.38], zoom: 10, bbox: [-76.5634, 37.7178, -76.1963, 38.0285] },
    nottoway: { name: "Nottoway County", type: "county", fips: "135", center: [37.14, -78.05], zoom: 10, bbox: [-78.2688, 36.9648, -77.8278, 37.3186] },
    orange: { name: "Orange County", type: "county", fips: "137", center: [38.24, -78.01], zoom: 10, bbox: [-78.3412, 38.0287, -77.7055, 38.4658] },
    page: { name: "Page County", type: "county", fips: "139", center: [38.62, -78.47], zoom: 10, bbox: [-78.6693, 38.4148, -78.2848, 38.8201] },
    patrick: { name: "Patrick County", type: "county", fips: "141", center: [36.68, -80.28], zoom: 10, bbox: [-80.5466, 36.5043, -80.0225, 36.8608] },
    pittsylvania: { name: "Pittsylvania County", type: "county", fips: "143", center: [36.82, -79.39], zoom: 10, bbox: [-79.7159, 36.5416, -79.0408, 37.1417] },
    powhatan: { name: "Powhatan County", type: "county", fips: "145", center: [37.55, -77.92], zoom: 10, bbox: [-78.1055, 37.3887, -77.6556, 37.6776] },
    prince_edward: { name: "Prince Edward County", type: "county", fips: "147", center: [37.22, -78.44], zoom: 10, bbox: [-78.6831, 37.0196, -78.1987, 37.4179] },
    prince_george: { name: "Prince George County", type: "county", fips: "149", center: [37.19, -77.22], zoom: 10, bbox: [-77.4461, 37.0065, -76.9276, 37.3594] },
    prince_william: { name: "Prince William County", type: "county", fips: "153", center: [38.7, -77.48], zoom: 10, bbox: [-77.7192, 38.5119, -77.2441, 38.8927] },
    pulaski: { name: "Pulaski County", type: "county", fips: "155", center: [37.06, -80.71], zoom: 10, bbox: [-80.9141, 36.9137, -80.4692, 37.2082] },
    rappahannock: { name: "Rappahannock County", type: "county", fips: "157", center: [38.68, -78.16], zoom: 10, bbox: [-78.3993, 38.4943, -78.0035, 38.8816] },
    richmond_county: { name: "Richmond County", type: "county", fips: "159", center: [37.94, -76.73], zoom: 10, bbox: [-76.9387, 37.8177, -76.5258, 38.0669] },
    roanoke_county: { name: "Roanoke County", type: "county", fips: "161", center: [37.28, -80.05], zoom: 10, bbox: [-80.2627, 37.1064, -79.8438, 37.4234] },
    rockbridge: { name: "Rockbridge County", type: "county", fips: "163", center: [37.81, -79.45], zoom: 10, bbox: [-79.8017, 37.5278, -79.0777, 38.0479] },
    rockingham: { name: "Rockingham County", type: "county", fips: "165", center: [38.51, -78.88], zoom: 10, bbox: [-79.2263, 38.1917, -78.5423, 38.8248] },
    russell: { name: "Russell County", type: "county", fips: "167", center: [36.93, -82.1], zoom: 10, bbox: [-82.3325, 36.7541, -81.8485, 37.1189] },
    scott: { name: "Scott County", type: "county", fips: "169", center: [36.71, -82.61], zoom: 10, bbox: [-82.9002, 36.5935, -82.3147, 36.8755] },
    shenandoah: { name: "Shenandoah County", type: "county", fips: "171", center: [38.86, -78.57], zoom: 10, bbox: [-78.8234, 38.6141, -78.3135, 39.1133] },
    smyth: { name: "Smyth County", type: "county", fips: "173", center: [36.85, -81.54], zoom: 10, bbox: [-81.8485, 36.7024, -81.2612, 37.0093] },
    southampton: { name: "Southampton County", type: "county", fips: "175", center: [36.72, -77.1], zoom: 10, bbox: [-77.4291, 36.5444, -76.7608, 36.9481] },
    spotsylvania: { name: "Spotsylvania County", type: "county", fips: "177", center: [38.18, -77.66], zoom: 10, bbox: [-77.8547, 37.9859, -77.3694, 38.4034] },
    stafford: { name: "Stafford County", type: "county", fips: "179", center: [38.43, -77.45], zoom: 10, bbox: [-77.6573, 38.2574, -77.2435, 38.6134] },
    surry: { name: "Surry County", type: "county", fips: "181", center: [37.12, -76.88], zoom: 10, bbox: [-77.1149, 36.9476, -76.5866, 37.3067] },
    sussex: { name: "Sussex County", type: "county", fips: "183", center: [36.92, -77.26], zoom: 10, bbox: [-77.5068, 36.6997, -76.9276, 37.1426] },
    tazewell: { name: "Tazewell County", type: "county", fips: "185", center: [37.12, -81.52], zoom: 10, bbox: [-81.8485, 36.9538, -81.2245, 37.3185] },
    warren: { name: "Warren County", type: "county", fips: "187", center: [38.91, -78.21], zoom: 10, bbox: [-78.3949, 38.7581, -78.0035, 39.0626] },
    washington: { name: "Washington County", type: "county", fips: "191", center: [36.72, -81.95], zoom: 10, bbox: [-82.3147, 36.5413, -81.6469, 36.9311] },
    westmoreland: { name: "Westmoreland County", type: "county", fips: "193", center: [38.11, -76.8], zoom: 10, bbox: [-77.0312, 37.9657, -76.5147, 38.2749] },
    wise: { name: "Wise County", type: "county", fips: "195", center: [36.98, -82.62], zoom: 10, bbox: [-82.9005, 36.8755, -82.3147, 37.1189] },
    wythe: { name: "Wythe County", type: "county", fips: "197", center: [36.92, -81.08], zoom: 10, bbox: [-81.3447, 36.7541, -80.8546, 37.0872] },
    york: { name: "York County", type: "county", fips: "199", center: [37.23, -76.54], zoom: 11, bbox: [-76.7521, 37.0891, -76.3845, 37.4133] },

    // Independent Cities (38)
    alexandria: { name: "Alexandria City", type: "city", fips: "510", center: [38.82, -77.08], zoom: 13, bbox: [-77.1441, 38.7852, -77.0268, 38.8452] },
    bristol: { name: "Bristol City", type: "city", fips: "520", center: [36.61, -82.17], zoom: 13, bbox: [-82.2162, 36.5755, -82.1126, 36.6447] },
    buena_vista: { name: "Buena Vista City", type: "city", fips: "530", center: [37.73, -79.35], zoom: 13, bbox: [-79.3905, 37.7047, -79.3158, 37.7654] },
    charlottesville: { name: "Charlottesville City", type: "city", fips: "540", center: [38.03, -78.48], zoom: 13, bbox: [-78.5234, 37.9966, -78.4429, 38.0653] },
    chesapeake: { name: "Chesapeake City", type: "city", fips: "550", center: [36.77, -76.29], zoom: 10, bbox: [-76.4912, 36.5499, -76.0553, 36.9228] },
    colonial_heights: { name: "Colonial Heights City", type: "city", fips: "570", center: [37.26, -77.4], zoom: 13, bbox: [-77.4275, 37.2259, -77.3627, 37.2883] },
    covington: { name: "Covington City", type: "city", fips: "580", center: [37.79, -79.99], zoom: 14, bbox: [-80.0186, 37.7686, -79.9661, 37.8122] },
    danville: { name: "Danville City", type: "city", fips: "590", center: [36.59, -79.39], zoom: 12, bbox: [-79.4914, 36.5423, -79.2996, 36.6479] },
    emporia: { name: "Emporia City", type: "city", fips: "595", center: [36.69, -77.54], zoom: 13, bbox: [-77.5734, 36.6657, -77.5066, 36.7142] },
    fairfax_city: { name: "Fairfax City", type: "city", fips: "600", center: [38.85, -77.31], zoom: 14, bbox: [-77.3413, 38.8305, -77.2765, 38.8692] },
    falls_church: { name: "Falls Church City", type: "city", fips: "610", center: [38.88, -77.17], zoom: 14, bbox: [-77.1952, 38.8608, -77.1519, 38.8942] },
    franklin_city: { name: "Franklin City", type: "city", fips: "620", center: [36.68, -76.94], zoom: 14, bbox: [-76.9668, 36.6595, -76.9067, 36.6993] },
    fredericksburg: { name: "Fredericksburg City", type: "city", fips: "630", center: [38.3, -77.46], zoom: 13, bbox: [-77.5054, 38.2703, -77.4244, 38.3385] },
    galax: { name: "Galax City", type: "city", fips: "640", center: [36.66, -80.92], zoom: 13, bbox: [-80.9558, 36.6323, -80.8858, 36.6877] },
    hampton: { name: "Hampton City", type: "city", fips: "650", center: [37.05, -76.35], zoom: 11, bbox: [-76.4912, 36.9657, -76.2489, 37.1329] },
    harrisonburg: { name: "Harrisonburg City", type: "city", fips: "660", center: [38.45, -78.87], zoom: 13, bbox: [-78.9148, 38.4086, -78.8317, 38.4895] },
    hopewell: { name: "Hopewell City", type: "city", fips: "670", center: [37.3, -77.29], zoom: 13, bbox: [-77.3278, 37.2652, -77.2576, 77.3337] },
    lexington: { name: "Lexington City", type: "city", fips: "678", center: [37.78, -79.44], zoom: 14, bbox: [-79.4615, 37.7656, -79.4224, 37.7993] },
    lynchburg: { name: "Lynchburg City", type: "city", fips: "680", center: [37.41, -79.14], zoom: 12, bbox: [-79.2532, 37.3435, -79.0476, 37.4741] },
    manassas: { name: "Manassas City", type: "city", fips: "683", center: [38.75, -77.48], zoom: 13, bbox: [-77.5127, 38.7226, -77.4416, 38.7793] },
    manassas_park: { name: "Manassas Park City", type: "city", fips: "685", center: [38.77, -77.44], zoom: 14, bbox: [-77.4632, 38.7545, -77.4234, 38.7855] },
    martinsville: { name: "Martinsville City", type: "city", fips: "690", center: [36.69, -79.87], zoom: 13, bbox: [-79.9096, 36.6611, -79.8322, 36.7189] },
    newport_news: { name: "Newport News City", type: "city", fips: "700", center: [37.09, -76.52], zoom: 11, bbox: [-76.6636, 36.9604, -76.3845, 37.2352] },
    norfolk: { name: "Norfolk City", type: "city", fips: "710", center: [36.85, -76.29], zoom: 12, bbox: [-76.3845, 36.7958, -76.1902, 36.9446] },
    norton: { name: "Norton City", type: "city", fips: "720", center: [36.93, -82.63], zoom: 14, bbox: [-82.6667, 36.9078, -82.6001, 36.9522] },
    petersburg: { name: "Petersburg City", type: "city", fips: "730", center: [37.21, -77.4], zoom: 13, bbox: [-77.4536, 37.1783, -77.3473, 37.2449] },
    poquoson: { name: "Poquoson City", type: "city", fips: "735", center: [37.13, -76.35], zoom: 12, bbox: [-76.4137, 37.0891, -76.2868, 37.1717] },
    portsmouth: { name: "Portsmouth City", type: "city", fips: "740", center: [36.84, -76.35], zoom: 12, bbox: [-76.4331, 36.7717, -76.2868, 36.9054] },
    radford: { name: "Radford City", type: "city", fips: "750", center: [37.13, -80.56], zoom: 13, bbox: [-80.6017, 37.1041, -80.5177, 37.1561] },
    richmond_city: { name: "Richmond City", type: "city", fips: "760", center: [37.54, -77.44], zoom: 12, bbox: [-77.5744, 37.4465, -77.3852, 37.5987] },
    roanoke_city: { name: "Roanoke City", type: "city", fips: "770", center: [37.27, -79.94], zoom: 12, bbox: [-80.0186, 37.2198, -79.8733, 37.3234] },
    salem: { name: "Salem City", type: "city", fips: "775", center: [37.29, -80.05], zoom: 13, bbox: [-80.1006, 37.2585, -79.9962, 37.3227] },
    staunton: { name: "Staunton City", type: "city", fips: "790", center: [38.15, -79.07], zoom: 13, bbox: [-79.1186, 38.1196, -79.0247, 38.1804] },
    suffolk: { name: "Suffolk City", type: "city", fips: "800", center: [36.73, -76.58], zoom: 10, bbox: [-76.8861, 36.5501, -76.3845, 36.9446] },
    virginia_beach: { name: "Virginia Beach City", type: "city", fips: "810", center: [36.85, -75.98], zoom: 10, bbox: [-76.1902, 36.5504, -75.8631, 36.9336] },
    waynesboro: { name: "Waynesboro City", type: "city", fips: "820", center: [38.07, -78.89], zoom: 13, bbox: [-78.9269, 38.0409, -78.8614, 38.0991] },
    williamsburg: { name: "Williamsburg City", type: "city", fips: "830", center: [37.27, -76.71], zoom: 13, bbox: [-76.7421, 37.2498, -76.683, 37.2972] },
    winchester: { name: "Winchester City", type: "city", fips: "840", center: [39.19, -78.17], zoom: 13, bbox: [-78.2074, 39.1383, -78.1252, 39.213] }
};

// Calculate road length in miles using Haversine formula
function calcLength(coords) {
    let total = 0;
    for (let i = 0; i < coords.length - 1; i++) {
        const [lat1, lon1] = coords[i];
        const [lat2, lon2] = coords[i + 1];
        const R = 3959; // Earth's radius in miles
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
        total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
    return total;
}

// Fetch with retry and timeout
async function fetchWithRetry(url, options, retries = CONFIG.maxRetries) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout);

            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.log(`  Attempt ${attempt}/${retries} failed: ${error.message}`);
            if (attempt < retries) {
                console.log(`  Waiting ${CONFIG.retryDelay / 1000}s before retry...`);
                await new Promise(r => setTimeout(r, CONFIG.retryDelay));
            }
        }
    }
    return null;
}

// Fetch road data from Overpass API
async function fetchRoadData(jurisdictionId) {
    const j = JURISDICTIONS[jurisdictionId];
    if (!j) {
        console.error(`Unknown jurisdiction: ${jurisdictionId}`);
        return null;
    }

    const [west, south, east, north] = j.bbox;

    const hwTypes = [
        'motorway', 'motorway_link', 'trunk', 'trunk_link',
        'primary', 'primary_link', 'secondary', 'secondary_link',
        'tertiary', 'tertiary_link', 'unclassified'
    ];

    const wayQueries = hwTypes.map(t =>
        `way["highway"="${t}"](${south},${west},${north},${east});`
    ).join('\n');

    const query = `[out:json][timeout:120];(${wayQueries});out body geom;`;

    // Try each server
    for (const server of CONFIG.overpassServers) {
        const serverName = new URL(server).hostname.split('.')[0];
        console.log(`  Trying ${serverName}...`);

        const data = await fetchWithRetry(server, {
            method: 'POST',
            body: `data=${encodeURIComponent(query)}`,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        if (data && data.elements) {
            return data;
        }
    }

    return null;
}

// Process raw OSM data into our format
function processRoadData(osmData, jurisdictionId) {
    const j = JURISDICTIONS[jurisdictionId];
    const roads = [];
    let totalMiles = 0;

    const fcCounts = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0 };

    for (const el of osmData.elements) {
        if (el.type !== 'way' || !el.geometry) continue;

        const tags = el.tags || {};
        const highway = tags.highway;
        const funcClass = OSM_TO_VDOT[highway] || '7';
        const coords = el.geometry.map(p => [p.lat, p.lon]);
        const length = calcLength(coords);

        const road = {
            id: el.id,
            name: tags.name || tags.ref || `Unnamed ${highway}`,
            highway,
            funcClass,
            ref: tags.ref || '',
            lanes: tags.lanes || '',
            maxspeed: tags.maxspeed || '',
            surface: tags.surface || '',
            length: Math.round(length * 1000) / 1000, // 3 decimal places
            coords
        };

        roads.push(road);
        totalMiles += length;
        fcCounts[funcClass]++;
    }

    return {
        jurisdiction: jurisdictionId,
        jurisdictionName: j.name,
        generated: new Date().toISOString(),
        version: "1.0",
        roadCount: roads.length,
        totalMiles: Math.round(totalMiles * 100) / 100,
        fcBreakdown: fcCounts,
        roads
    };
}

// Save road data to file
function saveRoadData(data, jurisdictionId) {
    const filePath = path.join(__dirname, '..', 'data', 'roads', `${jurisdictionId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`  Saved to ${filePath}`);
    return filePath;
}

// Update manifest
function updateManifest(jurisdictionId, data) {
    const manifestPath = path.join(__dirname, '..', 'data', 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    manifest.jurisdictions[jurisdictionId] = {
        available: true,
        lastUpdated: data.generated,
        roadCount: data.roadCount,
        totalMiles: data.totalMiles
    };

    manifest.generated = new Date().toISOString();

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`  Updated manifest.json`);
}

// Main function
async function main() {
    console.log('===========================================');
    console.log('  CRASH LENS - Road Data Generator');
    console.log('===========================================\n');

    // Get jurisdictions to process
    let jurisdictionsToProcess = process.argv.slice(2);

    if (jurisdictionsToProcess.length === 0) {
        // Process all jurisdictions
        jurisdictionsToProcess = Object.keys(JURISDICTIONS);
        console.log(`Processing ALL ${jurisdictionsToProcess.length} jurisdictions...\n`);
    } else {
        console.log(`Processing ${jurisdictionsToProcess.length} jurisdiction(s)...\n`);
    }

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < jurisdictionsToProcess.length; i++) {
        const jId = jurisdictionsToProcess[i];
        const j = JURISDICTIONS[jId];

        if (!j) {
            console.log(`[${i + 1}/${jurisdictionsToProcess.length}] SKIP: Unknown jurisdiction "${jId}"`);
            failCount++;
            continue;
        }

        console.log(`[${i + 1}/${jurisdictionsToProcess.length}] ${j.name}`);

        // Fetch data
        const osmData = await fetchRoadData(jId);

        if (!osmData) {
            console.log(`  FAILED: Could not fetch data\n`);
            failCount++;
            continue;
        }

        console.log(`  Received ${osmData.elements.length} elements`);

        // Process data
        const processedData = processRoadData(osmData, jId);
        console.log(`  Processed ${processedData.roadCount} roads (${processedData.totalMiles} miles)`);

        // Save to file
        saveRoadData(processedData, jId);

        // Update manifest
        updateManifest(jId, processedData);

        successCount++;
        console.log(`  SUCCESS\n`);

        // Delay between jurisdictions to avoid rate limiting
        if (i < jurisdictionsToProcess.length - 1) {
            console.log(`  Waiting ${CONFIG.delayBetweenJurisdictions / 1000}s before next jurisdiction...\n`);
            await new Promise(r => setTimeout(r, CONFIG.delayBetweenJurisdictions));
        }
    }

    console.log('===========================================');
    console.log(`  COMPLETE: ${successCount} success, ${failCount} failed`);
    console.log('===========================================');
}

main().catch(console.error);
