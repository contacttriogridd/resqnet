import type { ContactService } from './enums.js';
import type { GuideSection } from './schemas.js';

/**
 * Built-in life-safety content. It is compiled INTO the frontend bundle so
 * that it is available offline on first launch — before any API call has
 * ever succeeded — and is also used to seed the database. Administrators can
 * update the server copy; devices then receive the newer version on sync.
 *
 * Guidance follows widely published public-safety advice (NDMA India,
 * Red Cross / IFRC). It is general guidance: always follow instructions from
 * local authorities.
 */

export interface DisasterTypeContent {
  code: string;
  name: string;
  description: string;
}

export const DEFAULT_DISASTER_TYPES: DisasterTypeContent[] = [
  { code: 'FLOOD', name: 'Flood', description: 'Rising water from rivers, rain, dams or storm surge.' },
  { code: 'CYCLONE', name: 'Cyclone', description: 'Tropical cyclone with damaging winds, rain and storm surge.' },
  { code: 'EARTHQUAKE', name: 'Earthquake', description: 'Sudden ground shaking and aftershocks.' },
  { code: 'LANDSLIDE', name: 'Landslide', description: 'Movement of rock, earth or debris down a slope.' },
  { code: 'TSUNAMI', name: 'Tsunami', description: 'Series of large sea waves, usually after an undersea earthquake.' },
  { code: 'HEAVY_RAIN', name: 'Heavy rainfall', description: 'Intense rainfall that can cause waterlogging and flash floods.' },
  { code: 'FOREST_FIRE', name: 'Forest fire', description: 'Uncontrolled fire in forest or grassland.' },
  { code: 'FIRE', name: 'Fire', description: 'Building or urban fire.' },
  { code: 'STORM', name: 'Storm', description: 'Thunderstorm, lightning and strong winds.' },
  { code: 'GENERAL', name: 'General emergency', description: 'Preparedness that applies to every emergency.' },
];

export interface GuideContent {
  slug: string;
  title: string;
  disasterTypeCode: string;
  summary: string;
  sections: GuideSection[];
  sortOrder: number;
}

export const DEFAULT_SAFETY_GUIDES: GuideContent[] = [
  {
    slug: 'flood',
    title: 'Flood',
    disasterTypeCode: 'FLOOD',
    summary: 'Get to higher ground and stay out of flood water.',
    sortOrder: 10,
    sections: [
      {
        title: 'Do this now',
        items: [
          'Move to higher ground or an upper floor immediately.',
          'Turn off electricity and gas at the main switch — only if it is safe and you are not standing in water.',
          'Take your emergency kit, medicines, documents and phone charger.',
          'Follow evacuation instructions from local authorities without delay.',
        ],
      },
      {
        title: 'Do NOT',
        items: [
          'Do not walk, swim or drive through moving flood water — 15 cm can knock you down, 60 cm can sweep away a car.',
          'Do not drive on flooded roads or across flooded bridges.',
          'Do not touch electrical equipment or fallen power lines.',
          'Do not let children play in or near flood water.',
        ],
      },
      {
        title: 'If you are trapped',
        items: [
          'Go to the highest level of the building. Avoid closed attics where you could be trapped by rising water.',
          'Signal for help from a window or roof with a bright cloth or torch.',
          'Use RESQNET "Request help" — it will be saved and sent automatically if you are offline.',
        ],
      },
      {
        title: 'After the flood',
        items: [
          'Return home only when authorities say it is safe.',
          'Drink only boiled, bottled or treated water.',
          'Throw away food that touched flood water.',
          'Watch for snakes, sharp debris and weakened floors.',
        ],
      },
    ],
  },
  {
    slug: 'earthquake',
    title: 'Earthquake',
    disasterTypeCode: 'EARTHQUAKE',
    summary: 'Drop, Cover and Hold On until the shaking stops.',
    sortOrder: 20,
    sections: [
      {
        title: 'During shaking',
        items: [
          'DROP to your hands and knees.',
          'COVER your head and neck under a sturdy table or desk, or next to an interior wall.',
          'HOLD ON until the shaking stops.',
          'Move away from windows, glass, mirrors and heavy furniture that could fall.',
          'If outdoors, move to an open area away from buildings, trees and power lines.',
          'If in a vehicle, stop in a clear area and stay inside with your seatbelt on.',
        ],
      },
      {
        title: 'Do NOT',
        items: [
          'Do not use elevators.',
          'Do not run outside while the ground is shaking.',
          'Do not stand in doorways — they do not protect you from falling objects.',
        ],
      },
      {
        title: 'After shaking stops',
        items: [
          'Expect aftershocks. Drop, Cover and Hold On again if they happen.',
          'Leave damaged buildings carefully using the stairs.',
          'Check yourself and others for injuries. Give first aid if trained.',
          'If you smell gas, leave immediately and do not use flames or switches.',
          'If trapped, tap on a pipe or wall so rescuers can hear you. Shout only as a last resort to avoid inhaling dust.',
        ],
      },
    ],
  },
  {
    slug: 'cyclone',
    title: 'Cyclone',
    disasterTypeCode: 'CYCLONE',
    summary: 'Stay indoors, away from the coast, and follow evacuation orders.',
    sortOrder: 30,
    sections: [
      {
        title: 'Before it arrives',
        items: [
          'Follow official weather warnings and evacuation instructions.',
          'Secure or bring indoors loose objects that wind can throw.',
          'Charge your phone and power banks. Store drinking water and dry food.',
          'Know the way to your nearest cyclone shelter.',
        ],
      },
      {
        title: 'During the cyclone',
        items: [
          'Stay indoors in the strongest part of the building, away from windows.',
          'Avoid coastal areas, beaches and river banks.',
          'If the eye of the storm passes, stay inside — winds return quickly from the other direction.',
          'Evacuate immediately if authorities tell you to.',
        ],
      },
      {
        title: 'After the cyclone',
        items: [
          'Stay away from fallen power lines and damaged buildings.',
          'Do not go sightseeing in affected areas.',
          'Use RESQNET to share your safety status with family and responders.',
        ],
      },
    ],
  },
  {
    slug: 'tsunami',
    title: 'Tsunami',
    disasterTypeCode: 'TSUNAMI',
    summary: 'Move inland or to high ground immediately. Do not wait.',
    sortOrder: 40,
    sections: [
      {
        title: 'Natural warning signs',
        items: [
          'A strong earthquake near the coast.',
          'The sea suddenly pulling back and exposing the sea floor.',
          'A loud roar from the ocean.',
          'If you notice any of these, act immediately — do not wait for an official warning.',
        ],
      },
      {
        title: 'Do this now',
        items: [
          'Move inland or to high ground (at least 30 metres above sea level or 3 km inland if possible).',
          'If you cannot leave, go to the upper floors of a strong concrete building.',
          'Follow evacuation route signs and official instructions.',
        ],
      },
      {
        title: 'Do NOT',
        items: [
          'Do not go to the coast to watch the waves.',
          'Do not return after the first wave — more waves follow, and later ones can be larger.',
          'Stay away until officials say it is safe.',
        ],
      },
    ],
  },
  {
    slug: 'fire',
    title: 'Fire',
    disasterTypeCode: 'FIRE',
    summary: 'Get out, stay low under smoke, and call 101 or 112.',
    sortOrder: 50,
    sections: [
      {
        title: 'Get out',
        items: [
          'Alert everyone and leave immediately by the nearest emergency exit.',
          'Stay low under smoke — cleaner air is near the floor.',
          'Feel doors with the back of your hand before opening. If hot, use another way out.',
          'Close doors behind you to slow the fire.',
          'Once out, stay out. Call Fire & Rescue (101) or 112.',
        ],
      },
      {
        title: 'Do NOT',
        items: [
          'Do not use elevators.',
          'Do not go back inside for belongings.',
          'Do not use water on electrical or oil fires.',
        ],
      },
      {
        title: 'If you are trapped',
        items: [
          'Close the door and seal gaps with wet cloth.',
          'Signal from a window with a bright cloth or torch.',
          'Call 112 and tell them exactly where you are.',
        ],
      },
      {
        title: 'If clothes catch fire',
        items: ['STOP, DROP and ROLL. Cover your face with your hands.', 'Cool burns with clean running water for 20 minutes.'],
      },
    ],
  },
  {
    slug: 'landslide',
    title: 'Landslide',
    disasterTypeCode: 'LANDSLIDE',
    summary: 'Move away from slopes and the path of the slide.',
    sortOrder: 60,
    sections: [
      {
        title: 'Warning signs',
        items: [
          'New cracks in the ground, walls or roads.',
          'Tilting trees, poles or fences.',
          'Sudden increase or decrease in stream water, or muddy water.',
          'Rumbling sounds from the slope.',
        ],
      },
      {
        title: 'Do this now',
        items: [
          'Move away from the path of the slide, to the side — not downhill.',
          'Avoid steep slopes, river valleys and unstable structures.',
          'Follow evacuation instructions from local authorities.',
          'Stay alert during and after heavy rain, especially at night.',
        ],
      },
      {
        title: 'After a landslide',
        items: [
          'Stay away from the slide area — more slides may follow.',
          'Report broken roads, power lines and trapped people to authorities.',
        ],
      },
    ],
  },
  {
    slug: 'heavy-rain-storm',
    title: 'Heavy rain & storms',
    disasterTypeCode: 'STORM',
    summary: 'Shelter indoors, avoid water-logged roads and lightning.',
    sortOrder: 70,
    sections: [
      {
        title: 'Stay safe',
        items: [
          'Stay indoors and away from windows during lightning.',
          'Unplug electrical appliances. Avoid using landline phones during lightning.',
          'Avoid water-logged roads, underpasses and open drains.',
          'If outdoors, avoid tall trees, poles and open fields. Crouch low if you cannot find shelter.',
        ],
      },
    ],
  },
  {
    slug: 'forest-fire',
    title: 'Forest fire',
    disasterTypeCode: 'FOREST_FIRE',
    summary: 'Leave early, move away from the fire and the wind direction.',
    sortOrder: 80,
    sections: [
      {
        title: 'Do this now',
        items: [
          'Leave early when authorities advise — do not wait to see the fire.',
          'Move away from the fire, across or against the wind direction.',
          'Cover your nose and mouth with a damp cloth to reduce smoke.',
          'Wear cotton or wool clothing that covers your skin.',
        ],
      },
    ],
  },
  {
    slug: 'emergency-kit',
    title: 'Emergency kit',
    disasterTypeCode: 'GENERAL',
    summary: 'Prepare a go-bag for 72 hours before disaster strikes.',
    sortOrder: 90,
    sections: [
      {
        title: 'Pack these',
        items: [
          'Drinking water (at least 3 litres per person per day) and dry food for 3 days.',
          'Medicines and copies of prescriptions.',
          'Torch, spare batteries and a fully charged power bank.',
          'Copies of ID, important documents and emergency phone numbers in a waterproof bag.',
          'First-aid kit, whistle, and basic hygiene items.',
          'Some cash, warm clothes and sturdy shoes.',
        ],
      },
      {
        title: 'Plan with your family',
        items: [
          'Agree on a meeting place and one out-of-area contact person.',
          'Add family members in RESQNET "Family" so their details are on your phone offline.',
          'Download offline emergency information for your area in RESQNET while you are online.',
        ],
      },
    ],
  },
];

export interface ContactContent {
  key: string;
  name: string;
  service: ContactService;
  phone: string;
  description: string;
  sortOrder: number;
}

/**
 * National emergency numbers for India. Bundled with the app so they can be
 * shown — and dialled — without any network request.
 */
export const DEFAULT_EMERGENCY_CONTACTS: ContactContent[] = [
  { key: 'erss', name: 'National Emergency Number', service: 'EMERGENCY', phone: '112', description: 'Police, fire and ambulance — single number for all emergencies.', sortOrder: 1 },
  { key: 'police', name: 'Police', service: 'POLICE', phone: '100', description: 'Police control room.', sortOrder: 2 },
  { key: 'fire', name: 'Fire & Rescue', service: 'FIRE_RESCUE', phone: '101', description: 'Fire, rescue from collapse or flood.', sortOrder: 3 },
  { key: 'ambulance', name: 'Ambulance', service: 'AMBULANCE', phone: '108', description: 'Emergency medical services.', sortOrder: 4 },
  { key: 'ndma', name: 'Disaster Management Helpline', service: 'DISASTER_MANAGEMENT', phone: '1078', description: 'National Disaster Management Authority helpline.', sortOrder: 5 },
  { key: 'seoc', name: 'State Emergency Operation Centre', service: 'CONTROL_ROOM', phone: '1070', description: 'State disaster control room.', sortOrder: 6 },
  { key: 'deoc', name: 'District Emergency Operation Centre', service: 'CONTROL_ROOM', phone: '1077', description: 'District collectorate disaster control room.', sortOrder: 7 },
  { key: 'women', name: 'Women Helpline', service: 'HELPLINE', phone: '1091', description: 'Women in distress.', sortOrder: 8 },
  { key: 'child', name: 'Childline', service: 'HELPLINE', phone: '1098', description: 'Children in need of care and protection.', sortOrder: 9 },
];
