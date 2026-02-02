# ============================================================
# VIRGINIA ROAD DATA GENERATOR - GOOGLE COLAB VERSION
# ============================================================
# Copy and paste this entire code into a single Colab cell and run it.
# It will generate road data for all 133 Virginia jurisdictions.
# ============================================================

import json
import os
import time
import math
import requests
from datetime import datetime

# Configuration
CONFIG = {
    'overpass_servers': [
        'https://overpass-api.de/api/interpreter',
        'https://overpass.kumi.systems/api/interpreter',
        'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
        'https://overpass.openstreetmap.ru/api/interpreter'
    ],
    'timeout': 300,
    'retry_delay': 5,
    'max_retries': 3,
    'delay_between_jurisdictions': 10
}

OSM_TO_VDOT = {
    'motorway': '1', 'motorway_link': '1',
    'trunk': '2', 'trunk_link': '2',
    'primary': '3', 'primary_link': '3',
    'secondary': '4', 'secondary_link': '4',
    'tertiary': '5', 'tertiary_link': '5',
    'unclassified': '6',
    'residential': '7', 'living_street': '7', 'service': '7'
}

JURISDICTIONS = {
    "accomack": {"name": "Accomack County", "type": "county", "fips": "001", "bbox": [-76.0533, 37.2918, -75.2429, 38.0274]},
    "albemarle": {"name": "Albemarle County", "type": "county", "fips": "003", "bbox": [-78.8399, 37.7273, -78.2637, 38.3034]},
    "alleghany": {"name": "Alleghany County", "type": "county", "fips": "005", "bbox": [-80.2213, 37.5672, -79.6473, 38.0134]},
    "amelia": {"name": "Amelia County", "type": "county", "fips": "007", "bbox": [-78.1777, 37.1458, -77.6553, 37.4678]},
    "amherst": {"name": "Amherst County", "type": "county", "fips": "009", "bbox": [-79.4745, 37.3962, -78.8591, 37.806]},
    "appomattox": {"name": "Appomattox County", "type": "county", "fips": "011", "bbox": [-79.0929, 37.2061, -78.5716, 37.5494]},
    "arlington": {"name": "Arlington County", "type": "county", "fips": "013", "bbox": [-77.1722, 38.8275, -77.032, 38.9341]},
    "augusta": {"name": "Augusta County", "type": "county", "fips": "015", "bbox": [-79.5431, 37.8873, -78.8617, 38.4767]},
    "bath": {"name": "Bath County", "type": "county", "fips": "017", "bbox": [-80.0564, 37.8573, -79.4479, 38.3947]},
    "bedford_county": {"name": "Bedford County", "type": "county", "fips": "019", "bbox": [-79.7888, 37.0341, -79.2507, 37.513]},
    "bland": {"name": "Bland County", "type": "county", "fips": "021", "bbox": [-81.3447, 36.9649, -80.8546, 37.2462]},
    "botetourt": {"name": "Botetourt County", "type": "county", "fips": "023", "bbox": [-80.074, 37.2847, -79.498, 37.8013]},
    "brunswick": {"name": "Brunswick County", "type": "county", "fips": "025", "bbox": [-78.0036, 36.5438, -77.6547, 37.0218]},
    "buchanan": {"name": "Buchanan County", "type": "county", "fips": "027", "bbox": [-82.3147, 37.0072, -81.7389, 37.5068]},
    "buckingham": {"name": "Buckingham County", "type": "county", "fips": "029", "bbox": [-78.8687, 37.3307, -78.2399, 37.7899]},
    "campbell": {"name": "Campbell County", "type": "county", "fips": "031", "bbox": [-79.4414, 37.0077, -78.8217, 37.4283]},
    "caroline": {"name": "Caroline County", "type": "county", "fips": "033", "bbox": [-77.6434, 37.7881, -77.0312, 38.3047]},
    "carroll": {"name": "Carroll County", "type": "county", "fips": "035", "bbox": [-80.9614, 36.5509, -80.4605, 36.9522]},
    "charles_city": {"name": "Charles City County", "type": "county", "fips": "036", "bbox": [-77.2495, 37.2423, -76.854, 37.4893]},
    "charlotte": {"name": "Charlotte County", "type": "county", "fips": "037", "bbox": [-78.9045, 36.7897, -78.3936, 37.2263]},
    "chesterfield": {"name": "Chesterfield County", "type": "county", "fips": "041", "bbox": [-77.8574, 37.1466, -77.3884, 37.5576]},
    "clarke": {"name": "Clarke County", "type": "county", "fips": "043", "bbox": [-78.1322, 39.0067, -77.8228, 39.2255]},
    "craig": {"name": "Craig County", "type": "county", "fips": "045", "bbox": [-80.4642, 37.2579, -79.9612, 37.6582]},
    "culpeper": {"name": "Culpeper County", "type": "county", "fips": "047", "bbox": [-78.2318, 38.2676, -77.6279, 38.7183]},
    "cumberland": {"name": "Cumberland County", "type": "county", "fips": "049", "bbox": [-78.4626, 37.3363, -78.0246, 37.6858]},
    "dickenson": {"name": "Dickenson County", "type": "county", "fips": "051", "bbox": [-82.5652, 37.0014, -82.0959, 37.2964]},
    "dinwiddie": {"name": "Dinwiddie County", "type": "county", "fips": "053", "bbox": [-77.9005, 36.8499, -77.3989, 37.3384]},
    "essex": {"name": "Essex County", "type": "county", "fips": "057", "bbox": [-77.1683, 37.7905, -76.6647, 38.1196]},
    "fairfax": {"name": "Fairfax County", "type": "county", "fips": "059", "bbox": [-77.5116, 38.5958, -77.0285, 39.0007]},
    "fauquier": {"name": "Fauquier County", "type": "county", "fips": "061", "bbox": [-78.0938, 38.4617, -77.5319, 38.9658]},
    "floyd": {"name": "Floyd County", "type": "county", "fips": "063", "bbox": [-80.5925, 36.7478, -80.0815, 37.0775]},
    "fluvanna": {"name": "Fluvanna County", "type": "county", "fips": "065", "bbox": [-78.5136, 37.6845, -78.0669, 38.0218]},
    "franklin_county": {"name": "Franklin County", "type": "county", "fips": "067", "bbox": [-80.1616, 36.7148, -79.5909, 37.2254]},
    "frederick": {"name": "Frederick County", "type": "county", "fips": "069", "bbox": [-78.5085, 39.0206, -78.0035, 39.3999]},
    "giles": {"name": "Giles County", "type": "county", "fips": "071", "bbox": [-80.9141, 37.1183, -80.4357, 37.5119]},
    "gloucester": {"name": "Gloucester County", "type": "county", "fips": "073", "bbox": [-76.7463, 37.2188, -76.2868, 37.5724]},
    "goochland": {"name": "Goochland County", "type": "county", "fips": "075", "bbox": [-78.1553, 37.5408, -77.6556, 37.8954]},
    "grayson": {"name": "Grayson County", "type": "county", "fips": "077", "bbox": [-81.5347, 36.5052, -80.9005, 36.8514]},
    "greene": {"name": "Greene County", "type": "county", "fips": "079", "bbox": [-78.6612, 38.1768, -78.2848, 38.4378]},
    "greensville": {"name": "Greensville County", "type": "county", "fips": "081", "bbox": [-77.7674, 36.5429, -77.2977, 36.8753]},
    "halifax": {"name": "Halifax County", "type": "county", "fips": "083", "bbox": [-79.2508, 36.5414, -78.6494, 37.0303]},
    "hanover": {"name": "Hanover County", "type": "county", "fips": "085", "bbox": [-77.7014, 37.5378, -77.1905, 38.0153]},
    "henrico": {"name": "Henrico County", "type": "county", "fips": "087", "bbox": [-77.6604, 37.3862, -77.1462, 37.7234]},
    "henry": {"name": "Henry County", "type": "county", "fips": "089", "bbox": [-80.0933, 36.5413, -79.6401, 36.8533]},
    "highland": {"name": "Highland County", "type": "county", "fips": "091", "bbox": [-79.8512, 38.1312, -79.2263, 38.5941]},
    "isle_of_wight": {"name": "Isle of Wight County", "type": "county", "fips": "093", "bbox": [-76.9259, 36.7127, -76.4226, 37.0703]},
    "james_city": {"name": "James City County", "type": "county", "fips": "095", "bbox": [-76.9275, 37.1767, -76.5866, 37.4387]},
    "king_and_queen": {"name": "King and Queen County", "type": "county", "fips": "097", "bbox": [-77.1485, 37.5269, -76.609, 37.9212]},
    "king_george": {"name": "King George County", "type": "county", "fips": "099", "bbox": [-77.3273, 38.1263, -76.9889, 38.4341]},
    "king_william": {"name": "King William County", "type": "county", "fips": "101", "bbox": [-77.3055, 37.5041, -76.8221, 37.8945]},
    "lancaster": {"name": "Lancaster County", "type": "county", "fips": "103", "bbox": [-76.6168, 37.5731, -76.2605, 37.8907]},
    "lee": {"name": "Lee County", "type": "county", "fips": "105", "bbox": [-83.4724, 36.5007, -82.8487, 36.9299]},
    "loudoun": {"name": "Loudoun County", "type": "county", "fips": "107", "bbox": [-77.9623, 38.8426, -77.3243, 39.3222]},
    "louisa": {"name": "Louisa County", "type": "county", "fips": "109", "bbox": [-78.2065, 37.8116, -77.6577, 38.2206]},
    "lunenburg": {"name": "Lunenburg County", "type": "county", "fips": "111", "bbox": [-78.5038, 36.7645, -78.0033, 37.1458]},
    "madison": {"name": "Madison County", "type": "county", "fips": "113", "bbox": [-78.4847, 38.2174, -78.0909, 38.5894]},
    "mathews": {"name": "Mathews County", "type": "county", "fips": "115", "bbox": [-76.4639, 37.2954, -76.1497, 37.5502]},
    "mecklenburg": {"name": "Mecklenburg County", "type": "county", "fips": "117", "bbox": [-78.6494, 36.5006, -78.0033, 36.9117]},
    "middlesex": {"name": "Middlesex County", "type": "county", "fips": "119", "bbox": [-76.7389, 37.4472, -76.2873, 37.7677]},
    "montgomery": {"name": "Montgomery County", "type": "county", "fips": "121", "bbox": [-80.6632, 36.9993, -80.1539, 37.3817]},
    "nelson": {"name": "Nelson County", "type": "county", "fips": "125", "bbox": [-79.1728, 37.5545, -78.6451, 38.0228]},
    "new_kent": {"name": "New Kent County", "type": "county", "fips": "127", "bbox": [-77.1857, 37.3514, -76.7696, 37.6717]},
    "northampton": {"name": "Northampton County", "type": "county", "fips": "131", "bbox": [-76.1329, 37.0697, -75.7194, 37.545]},
    "northumberland": {"name": "Northumberland County", "type": "county", "fips": "133", "bbox": [-76.5634, 37.7178, -76.1963, 38.0285]},
    "nottoway": {"name": "Nottoway County", "type": "county", "fips": "135", "bbox": [-78.2688, 36.9648, -77.8278, 37.3186]},
    "orange": {"name": "Orange County", "type": "county", "fips": "137", "bbox": [-78.3412, 38.0287, -77.7055, 38.4658]},
    "page": {"name": "Page County", "type": "county", "fips": "139", "bbox": [-78.6693, 38.4148, -78.2848, 38.8201]},
    "patrick": {"name": "Patrick County", "type": "county", "fips": "141", "bbox": [-80.5466, 36.5043, -80.0225, 36.8608]},
    "pittsylvania": {"name": "Pittsylvania County", "type": "county", "fips": "143", "bbox": [-79.7159, 36.5416, -79.0408, 37.1417]},
    "powhatan": {"name": "Powhatan County", "type": "county", "fips": "145", "bbox": [-78.1055, 37.3887, -77.6556, 37.6776]},
    "prince_edward": {"name": "Prince Edward County", "type": "county", "fips": "147", "bbox": [-78.6831, 37.0196, -78.1987, 37.4179]},
    "prince_george": {"name": "Prince George County", "type": "county", "fips": "149", "bbox": [-77.4461, 37.0065, -76.9276, 37.3594]},
    "prince_william": {"name": "Prince William County", "type": "county", "fips": "153", "bbox": [-77.7192, 38.5119, -77.2441, 38.8927]},
    "pulaski": {"name": "Pulaski County", "type": "county", "fips": "155", "bbox": [-80.9141, 36.9137, -80.4692, 37.2082]},
    "rappahannock": {"name": "Rappahannock County", "type": "county", "fips": "157", "bbox": [-78.3993, 38.4943, -78.0035, 38.8816]},
    "richmond_county": {"name": "Richmond County", "type": "county", "fips": "159", "bbox": [-76.9387, 37.8177, -76.5258, 38.0669]},
    "roanoke_county": {"name": "Roanoke County", "type": "county", "fips": "161", "bbox": [-80.2627, 37.1064, -79.8438, 37.4234]},
    "rockbridge": {"name": "Rockbridge County", "type": "county", "fips": "163", "bbox": [-79.8017, 37.5278, -79.0777, 38.0479]},
    "rockingham": {"name": "Rockingham County", "type": "county", "fips": "165", "bbox": [-79.2263, 38.1917, -78.5423, 38.8248]},
    "russell": {"name": "Russell County", "type": "county", "fips": "167", "bbox": [-82.3325, 36.7541, -81.8485, 37.1189]},
    "scott": {"name": "Scott County", "type": "county", "fips": "169", "bbox": [-82.9002, 36.5935, -82.3147, 36.8755]},
    "shenandoah": {"name": "Shenandoah County", "type": "county", "fips": "171", "bbox": [-78.8234, 38.6141, -78.3135, 39.1133]},
    "smyth": {"name": "Smyth County", "type": "county", "fips": "173", "bbox": [-81.8485, 36.7024, -81.2612, 37.0093]},
    "southampton": {"name": "Southampton County", "type": "county", "fips": "175", "bbox": [-77.4291, 36.5444, -76.7608, 36.9481]},
    "spotsylvania": {"name": "Spotsylvania County", "type": "county", "fips": "177", "bbox": [-77.8547, 37.9859, -77.3694, 38.4034]},
    "stafford": {"name": "Stafford County", "type": "county", "fips": "179", "bbox": [-77.6573, 38.2574, -77.2435, 38.6134]},
    "surry": {"name": "Surry County", "type": "county", "fips": "181", "bbox": [-77.1149, 36.9476, -76.5866, 37.3067]},
    "sussex": {"name": "Sussex County", "type": "county", "fips": "183", "bbox": [-77.5068, 36.6997, -76.9276, 37.1426]},
    "tazewell": {"name": "Tazewell County", "type": "county", "fips": "185", "bbox": [-81.8485, 36.9538, -81.2245, 37.3185]},
    "warren": {"name": "Warren County", "type": "county", "fips": "187", "bbox": [-78.3949, 38.7581, -78.0035, 39.0626]},
    "washington": {"name": "Washington County", "type": "county", "fips": "191", "bbox": [-82.3147, 36.5413, -81.6469, 36.9311]},
    "westmoreland": {"name": "Westmoreland County", "type": "county", "fips": "193", "bbox": [-77.0312, 37.9657, -76.5147, 38.2749]},
    "wise": {"name": "Wise County", "type": "county", "fips": "195", "bbox": [-82.9005, 36.8755, -82.3147, 37.1189]},
    "wythe": {"name": "Wythe County", "type": "county", "fips": "197", "bbox": [-81.3447, 36.7541, -80.8546, 37.0872]},
    "york": {"name": "York County", "type": "county", "fips": "199", "bbox": [-76.7521, 37.0891, -76.3845, 37.4133]},
    "alexandria": {"name": "Alexandria City", "type": "city", "fips": "510", "bbox": [-77.1441, 38.7852, -77.0268, 38.8452]},
    "bristol": {"name": "Bristol City", "type": "city", "fips": "520", "bbox": [-82.2162, 36.5755, -82.1126, 36.6447]},
    "buena_vista": {"name": "Buena Vista City", "type": "city", "fips": "530", "bbox": [-79.3905, 37.7047, -79.3158, 37.7654]},
    "charlottesville": {"name": "Charlottesville City", "type": "city", "fips": "540", "bbox": [-78.5234, 37.9966, -78.4429, 38.0653]},
    "chesapeake": {"name": "Chesapeake City", "type": "city", "fips": "550", "bbox": [-76.4912, 36.5499, -76.0553, 36.9228]},
    "colonial_heights": {"name": "Colonial Heights City", "type": "city", "fips": "570", "bbox": [-77.4275, 37.2259, -77.3627, 37.2883]},
    "covington": {"name": "Covington City", "type": "city", "fips": "580", "bbox": [-80.0186, 37.7686, -79.9661, 37.8122]},
    "danville": {"name": "Danville City", "type": "city", "fips": "590", "bbox": [-79.4914, 36.5423, -79.2996, 36.6479]},
    "emporia": {"name": "Emporia City", "type": "city", "fips": "595", "bbox": [-77.5734, 36.6657, -77.5066, 36.7142]},
    "fairfax_city": {"name": "Fairfax City", "type": "city", "fips": "600", "bbox": [-77.3413, 38.8305, -77.2765, 38.8692]},
    "falls_church": {"name": "Falls Church City", "type": "city", "fips": "610", "bbox": [-77.1952, 38.8608, -77.1519, 38.8942]},
    "franklin_city": {"name": "Franklin City", "type": "city", "fips": "620", "bbox": [-76.9668, 36.6595, -76.9067, 36.6993]},
    "fredericksburg": {"name": "Fredericksburg City", "type": "city", "fips": "630", "bbox": [-77.5054, 38.2703, -77.4244, 38.3385]},
    "galax": {"name": "Galax City", "type": "city", "fips": "640", "bbox": [-80.9558, 36.6323, -80.8858, 36.6877]},
    "hampton": {"name": "Hampton City", "type": "city", "fips": "650", "bbox": [-76.4912, 36.9657, -76.2489, 37.1329]},
    "harrisonburg": {"name": "Harrisonburg City", "type": "city", "fips": "660", "bbox": [-78.9148, 38.4086, -78.8317, 38.4895]},
    "hopewell": {"name": "Hopewell City", "type": "city", "fips": "670", "bbox": [-77.3278, 37.2652, -77.2576, 37.3337]},
    "lexington": {"name": "Lexington City", "type": "city", "fips": "678", "bbox": [-79.4615, 37.7656, -79.4224, 37.7993]},
    "lynchburg": {"name": "Lynchburg City", "type": "city", "fips": "680", "bbox": [-79.2532, 37.3435, -79.0476, 37.4741]},
    "manassas": {"name": "Manassas City", "type": "city", "fips": "683", "bbox": [-77.5127, 38.7226, -77.4416, 38.7793]},
    "manassas_park": {"name": "Manassas Park City", "type": "city", "fips": "685", "bbox": [-77.4632, 38.7545, -77.4234, 38.7855]},
    "martinsville": {"name": "Martinsville City", "type": "city", "fips": "690", "bbox": [-79.9096, 36.6611, -79.8322, 36.7189]},
    "newport_news": {"name": "Newport News City", "type": "city", "fips": "700", "bbox": [-76.6636, 36.9604, -76.3845, 37.2352]},
    "norfolk": {"name": "Norfolk City", "type": "city", "fips": "710", "bbox": [-76.3845, 36.7958, -76.1902, 36.9446]},
    "norton": {"name": "Norton City", "type": "city", "fips": "720", "bbox": [-82.6667, 36.9078, -82.6001, 36.9522]},
    "petersburg": {"name": "Petersburg City", "type": "city", "fips": "730", "bbox": [-77.4536, 37.1783, -77.3473, 37.2449]},
    "poquoson": {"name": "Poquoson City", "type": "city", "fips": "735", "bbox": [-76.4137, 37.0891, -76.2868, 37.1717]},
    "portsmouth": {"name": "Portsmouth City", "type": "city", "fips": "740", "bbox": [-76.4331, 36.7717, -76.2868, 36.9054]},
    "radford": {"name": "Radford City", "type": "city", "fips": "750", "bbox": [-80.6017, 37.1041, -80.5177, 37.1561]},
    "richmond_city": {"name": "Richmond City", "type": "city", "fips": "760", "bbox": [-77.5744, 37.4465, -77.3852, 37.5987]},
    "roanoke_city": {"name": "Roanoke City", "type": "city", "fips": "770", "bbox": [-80.0186, 37.2198, -79.8733, 37.3234]},
    "salem": {"name": "Salem City", "type": "city", "fips": "775", "bbox": [-80.1006, 37.2585, -79.9962, 37.3227]},
    "staunton": {"name": "Staunton City", "type": "city", "fips": "790", "bbox": [-79.1186, 38.1196, -79.0247, 38.1804]},
    "suffolk": {"name": "Suffolk City", "type": "city", "fips": "800", "bbox": [-76.8861, 36.5501, -76.3845, 36.9446]},
    "virginia_beach": {"name": "Virginia Beach City", "type": "city", "fips": "810", "bbox": [-76.1902, 36.5504, -75.8631, 36.9336]},
    "waynesboro": {"name": "Waynesboro City", "type": "city", "fips": "820", "bbox": [-78.9269, 38.0409, -78.8614, 38.0991]},
    "williamsburg": {"name": "Williamsburg City", "type": "city", "fips": "830", "bbox": [-76.7421, 37.2498, -76.683, 37.2972]},
    "winchester": {"name": "Winchester City", "type": "city", "fips": "840", "bbox": [-78.2074, 39.1383, -78.1252, 39.213]}
}

def calc_length(coords):
    total = 0.0
    R = 3959
    for i in range(len(coords) - 1):
        lat1, lon1 = coords[i]
        lat2, lon2 = coords[i + 1]
        d_lat = math.radians(lat2 - lat1)
        d_lon = math.radians(lon2 - lon1)
        a = (math.sin(d_lat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2) ** 2)
        total += R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return total

def fetch_with_retry(url, data, retries=3):
    for attempt in range(1, retries + 1):
        try:
            response = requests.post(url, data={'data': data}, timeout=CONFIG['timeout'], headers={'Content-Type': 'application/x-www-form-urlencoded'})
            if response.status_code != 200:
                raise Exception(f"HTTP {response.status_code}")
            return response.json()
        except Exception as e:
            print(f"    Attempt {attempt}/{retries} failed: {e}")
            if attempt < retries:
                print(f"    Waiting {CONFIG['retry_delay']}s...")
                time.sleep(CONFIG['retry_delay'])
    return None

def fetch_road_data(jurisdiction_id):
    j = JURISDICTIONS.get(jurisdiction_id)
    if not j:
        return None
    west, south, east, north = j['bbox']
    hw_types = ['motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link', 'secondary', 'secondary_link', 'tertiary', 'tertiary_link', 'unclassified']
    way_queries = '\n'.join([f'way["highway"="{t}"]({south},{west},{north},{east});' for t in hw_types])
    query = f'[out:json][timeout:300][maxsize:536870912];({way_queries});out body geom;'
    for server in CONFIG['overpass_servers']:
        server_name = server.split('//')[1].split('.')[0]
        print(f"    Trying {server_name}...")
        data = fetch_with_retry(server, query)
        if data and 'elements' in data:
            return data
    return None

def process_road_data(osm_data, jurisdiction_id):
    j = JURISDICTIONS[jurisdiction_id]
    roads = []
    total_miles = 0.0
    fc_counts = {'1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0}
    for el in osm_data.get('elements', []):
        if el.get('type') != 'way' or not el.get('geometry'):
            continue
        tags = el.get('tags', {})
        highway = tags.get('highway', '')
        func_class = OSM_TO_VDOT.get(highway, '7')
        coords = [[p['lat'], p['lon']] for p in el['geometry']]
        length = calc_length(coords)
        road = {
            'id': el['id'],
            'name': tags.get('name') or tags.get('ref') or f"Unnamed {highway}",
            'highway': highway,
            'funcClass': func_class,
            'ref': tags.get('ref', ''),
            'lanes': tags.get('lanes', ''),
            'maxspeed': tags.get('maxspeed', ''),
            'surface': tags.get('surface', ''),
            'length': round(length, 3),
            'coords': coords
        }
        roads.append(road)
        total_miles += length
        fc_counts[func_class] += 1
    return {
        'jurisdiction': jurisdiction_id,
        'jurisdictionName': j['name'],
        'generated': datetime.utcnow().isoformat() + 'Z',
        'version': '1.0',
        'roadCount': len(roads),
        'totalMiles': round(total_miles, 2),
        'fcBreakdown': fc_counts,
        'roads': roads
    }

def save_road_data(data, jurisdiction_id, output_dir='data'):
    roads_dir = os.path.join(output_dir, 'roads')
    os.makedirs(roads_dir, exist_ok=True)
    file_path = os.path.join(roads_dir, f'{jurisdiction_id}.json')
    with open(file_path, 'w') as f:
        json.dump(data, f)
    print(f"    Saved: {file_path}")
    return file_path

def update_manifest(jurisdiction_id, data, output_dir='data'):
    manifest_path = os.path.join(output_dir, 'manifest.json')
    if os.path.exists(manifest_path):
        with open(manifest_path, 'r') as f:
            manifest = json.load(f)
    else:
        manifest = {'generated': '', 'version': '1.0', 'jurisdictions': {}}
    manifest['jurisdictions'][jurisdiction_id] = {
        'available': True,
        'lastUpdated': data['generated'],
        'roadCount': data['roadCount'],
        'totalMiles': data['totalMiles']
    }
    manifest['generated'] = datetime.utcnow().isoformat() + 'Z'
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f)

# ============================================================
# MAIN EXECUTION - GENERATES ALL DATA
# ============================================================
print("=" * 60)
print("  VIRGINIA ROAD DATA GENERATOR")
print("  Processing 133 jurisdictions (95 counties + 38 cities)")
print("=" * 60)
print()

output_dir = 'data'
os.makedirs(output_dir, exist_ok=True)

jurisdictions_list = list(JURISDICTIONS.keys())
success_count = 0
fail_count = 0
failed_list = []

for i, j_id in enumerate(jurisdictions_list):
    j = JURISDICTIONS[j_id]
    print(f"[{i + 1}/{len(jurisdictions_list)}] {j['name']}")

    osm_data = fetch_road_data(j_id)

    if not osm_data:
        print(f"    FAILED\n")
        fail_count += 1
        failed_list.append(j_id)
        continue

    print(f"    Got {len(osm_data.get('elements', []))} elements")

    processed_data = process_road_data(osm_data, j_id)
    print(f"    {processed_data['roadCount']} roads, {processed_data['totalMiles']} miles")

    save_road_data(processed_data, j_id, output_dir)
    update_manifest(j_id, processed_data, output_dir)

    success_count += 1
    print(f"    SUCCESS\n")

    if i < len(jurisdictions_list) - 1:
        time.sleep(CONFIG['delay_between_jurisdictions'])

print("=" * 60)
print(f"COMPLETE: {success_count} success, {fail_count} failed")
if failed_list:
    print(f"Failed: {', '.join(failed_list)}")
print("=" * 60)

# ============================================================
# DOWNLOAD ZIP FILE
# ============================================================
print("\nCreating ZIP file for download...")
import shutil
shutil.make_archive('virginia_road_data', 'zip', 'data')
print("ZIP created: virginia_road_data.zip")

# Uncomment below line to auto-download in Colab:
# from google.colab import files; files.download('virginia_road_data.zip')
