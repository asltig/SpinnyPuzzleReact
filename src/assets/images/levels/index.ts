/**
 * Color (puzzle) images — shown inside spinning rings during gameplay.
 * Farm, Insects, Savana are fully bundled; Seaworld/Jungle/Vehicles/Dinosaurs
 * have only tutorial-animal images bundled (rest come from server).
 */
const colorImages: Record<string, number> = {
  // Farm
  bee:     require('./bee.png'),
  bull:    require('./bull.png'),
  camel:   require('./camel.png'),
  cat:     require('./cat.png'),
  chicken: require('./chicken.png'),
  cock:    require('./cock.png'),
  cow:     require('./cow.png'),
  dog:     require('./dog.png'),
  donkey:  require('./donkey.png'),
  duck:    require('./duck.png'),
  goat:    require('./goat.png'),
  goose:   require('./goose.png'),
  horse:   require('./horse.png'),
  llama:   require('./llama.png'),
  pig:     require('./pig.png'),
  rabbit:  require('./rabbit.png'),
  sheep:   require('./sheep.png'),
  turkey:  require('./turkey.png'),
  // Insects
  ant:             require('./ant.png'),
  butterfly:       require('./butterfly.png'),
  caterpillar:     require('./caterpillar.png'),
  centipede:       require('./centipede.png'),
  cockroach:       require('./cockroach.png'),
  dragonfly:       require('./dragonfly.png'),
  fly:             require('./fly.png'),
  grasshopper:     require('./grasshopper.png'),
  greenjunebeetle: require('./greenjunebeetle.png'),
  herculesbeetle:  require('./herculesbeetle.png'),
  ladybug:         require('./ladybug.png'),
  mantis:          require('./mantis.png'),
  mosquito:        require('./mosquito.png'),
  scorpion:        require('./scorpion.png'),
  snail:           require('./snail.png'),
  spider:          require('./spider.png'),
  wasp:            require('./wasp.png'),
  worm:            require('./worm.png'),
  // Savana
  baboon:    require('./baboon.png'),
  buffalo:   require('./buffalo.png'),
  chameleon: require('./chameleon.png'),
  chimp:     require('./chimp.png'),
  crocodile: require('./crocodile.png'),
  elephant:  require('./elephant.png'),
  gazelle:   require('./gazelle.png'),
  giraffe:   require('./giraffe.png'),
  gorilla:   require('./gorilla.png'),
  hippo:     require('./hippo.png'),
  hyena:     require('./hyena.png'),
  lemur:     require('./lemur.png'),
  leopard:   require('./leopard.png'),
  lion:      require('./lion.png'),
  meerkat:   require('./meerkat.png'),
  ostrich:   require('./ostrich.png'),
  rhino:     require('./rhino.png'),
  vulture:   require('./vulture.png'),
  warthog:   require('./warthog.png'),
  zebra:     require('./zebra.png'),
  // Tutorial animals — one per remaining package
  airplane:   require('./airplane.png'),
  carnotaurus:require('./carnotaurus.png'),
  clownfish:  require('./clownfish.png'),
  cockatoo:   require('./cockatoo.png'),
};

/**
 * Get the full-color puzzle image for a level name.
 * Mirrors ObjC getPuzzleImage: — name.lowercased(), spaces removed.
 * Returns null when the image is not bundled (must be fetched from server).
 */
export function getColorImage(levelName: string): number | null {
  const key = levelName.toLowerCase().replace(/\s+/g, '');
  return colorImages[key] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Static image registry for level silhouette (layer) images.
 * React Native requires all require() calls to be statically analysable at
 * bundle time — dynamic paths are not supported.
 *
 * Naming mirrors ObjC getPuzzleLayerImageName:
 *   name.lowercased() + "_layer" (spaces removed)
 * e.g.  "DOG" → dog_layer,  "CLOWNFISH" → clownfish_layer
 */
import type { ImageSourcePropType } from 'react-native';

const layerImages: Record<string, ImageSourcePropType> = {
  // ── Farm ──────────────────────────────────────────────────────────────────
  bee_layer:      require('./bee_layer.png'),
  bull_layer:     require('./bull_layer.png'),
  camel_layer:    require('./camel_layer.png'),
  cat_layer:      require('./cat_layer.png'),
  chicken_layer:  require('./chicken_layer.png'),
  cock_layer:     require('./cock_layer.png'),
  cow_layer:      require('./cow_layer.png'),
  dog_layer:      require('./dog_layer.png'),
  donkey_layer:   require('./donkey_layer.png'),
  duck_layer:     require('./duck_layer.png'),
  goat_layer:     require('./goat_layer.png'),
  goose_layer:    require('./goose_layer.png'),
  horse_layer:    require('./horse_layer.png'),
  llama_layer:    require('./llama_layer.png'),
  pig_layer:      require('./pig_layer.png'),
  rabbit_layer:   require('./rabbit_layer.png'),
  sheep_layer:    require('./sheep_layer.png'),
  turkey_layer:   require('./turkey_layer.png'),

  // ── Insects ───────────────────────────────────────────────────────────────
  ant_layer:              require('./ant_layer.png'),
  butterfly_layer:        require('./butterfly_layer.png'),
  caterpillar_layer:      require('./caterpillar_layer.png'),
  centipede_layer:        require('./centipede_layer.png'),
  cockroach_layer:        require('./cockroach_layer.png'),
  dragonfly_layer:        require('./dragonfly_layer.png'),
  fly_layer:              require('./fly_layer.png'),
  grasshopper_layer:      require('./grasshopper_layer.png'),
  greenjunebeetle_layer:  require('./greenjunebeetle_layer.png'),
  herculesbeetle_layer:   require('./herculesbeetle_layer.png'),
  ladybug_layer:          require('./ladybug_layer.png'),
  mantis_layer:           require('./mantis_layer.png'),
  mosquito_layer:         require('./mosquito_layer.png'),
  scorpion_layer:         require('./scorpion_layer.png'),
  snail_layer:            require('./snail_layer.png'),
  spider_layer:           require('./spider_layer.png'),
  wasp_layer:             require('./wasp_layer.png'),
  worm_layer:             require('./worm_layer.png'),

  // ── Savana ────────────────────────────────────────────────────────────────
  baboon_layer:    require('./baboon_layer.png'),
  buffalo_layer:   require('./buffalo_layer.png'),
  chameleon_layer: require('./chameleon_layer.png'),
  chimp_layer:     require('./chimp_layer.png'),
  crocodile_layer: require('./crocodile_layer.png'),
  elephant_layer:  require('./elephant_layer.png'),
  gazelle_layer:   require('./gazelle_layer.png'),
  giraffe_layer:   require('./giraffe_layer.png'),
  gorilla_layer:   require('./gorilla_layer.png'),
  hippo_layer:     require('./hippo_layer.png'),
  hyena_layer:     require('./hyena_layer.png'),
  lemur_layer:     require('./lemur_layer.png'),
  leopard_layer:   require('./leopard_layer.png'),
  lion_layer:      require('./lion_layer.png'),
  meerkat_layer:   require('./meerkat_layer.png'),
  ostrich_layer:   require('./ostrich_layer.png'),
  rhino_layer:     require('./rhino_layer.png'),
  vulture_layer:   require('./vulture_layer.png'),
  warthog_layer:   require('./warthog_layer.png'),
  zebra_layer:     require('./zebra_layer.png'),

  // ── Seaworld ──────────────────────────────────────────────────────────────
  clownfish_layer:    require('./clownfish_layer.png'),
  crab_layer:         require('./crab_layer.png'),
  dolphin_layer:      require('./dolphin_layer.png'),
  eel_layer:          require('./eel_layer.png'),
  jellyfish_layer:    require('./jellyfish_layer.png'),
  lobster_layer:      require('./lobster_layer.png'),
  octopus_layer:      require('./octopus_layer.png'),
  oyster_layer:       require('./oyster_layer.png'),
  penguin_layer:      require('./penguin_layer.png'),
  porcupinefish_layer:require('./porcupinefish_layer.png'),
  seahorse_layer:     require('./seahorse_layer.png'),
  seal_layer:         require('./seal_layer.png'),
  shark_layer:        require('./shark_layer.png'),
  squid_layer:        require('./squid_layer.png'),
  starfish_layer:     require('./starfish_layer.png'),
  stingray_layer:     require('./stingray_layer.png'),
  swordfish_layer:    require('./swordfish_layer.png'),
  turtle_layer:       require('./turtle_layer.png'),
  walrus_layer:       require('./walrus_layer.png'),
  whale_layer:        require('./whale_layer.png'),

  // ── Jungle ────────────────────────────────────────────────────────────────
  anaconda_layer:      require('./anaconda_layer.png'),
  betta_layer:         require('./betta_layer.png'),
  bongo_layer:         require('./bongo_layer.png'),
  capybera_layer:      require('./capybera_layer.png'),
  chimpanzee_layer:    require('./chimpanzee_layer.png'),
  cobra_layer:         require('./cobra_layer.png'),
  cockatoo_layer:      require('./cockatoo_layer.png'),
  cougar_layer:        require('./cougar_layer.png'),
  flyingfox_layer:     require('./flyingfox_layer.png'),
  jaguar_layer:        require('./jaguar_layer.png'),
  komododragon_layer:  require('./komododragon_layer.png'),
  macaws_layer:        require('./macaws_layer.png'),
  mandrill_layer:      require('./mandrill_layer.png'),
  okapi_layer:         require('./okapi_layer.png'),
  orangutan_layer:     require('./orangutan_layer.png'),
  piranha_layer:       require('./piranha_layer.png'),
  poisondartfrog_layer:require('./poisondartfrog_layer.png'),
  spidermonkey_layer:  require('./spidermonkey_layer.png'),
  sunbear_layer:       require('./sunbear_layer.png'),
  tapir_layer:         require('./tapir_layer.png'),
  tarsier_layer:       require('./tarsier_layer.png'),
  toucan_layer:        require('./toucan_layer.png'),

  // ── Vehicles ──────────────────────────────────────────────────────────────
  airplane_layer:           require('./airplane_layer.png'),
  airship_layer:            require('./airship_layer.png'),
  ambulance_layer:          require('./ambulance_layer.png'),
  bicycle_layer:            require('./bicycle_layer.png'),
  boat_layer:               require('./boat_layer.png'),
  bus_layer:                require('./bus_layer.png'),
  cabriolet_layer:          require('./cabriolet_layer.png'),
  concretemixingtruck_layer:require('./concretemixingtruck_layer.png'),
  crane_layer:              require('./crane_layer.png'),
  excavator_layer:          require('./excavator_layer.png'),
  fireengine_layer:         require('./fireengine_layer.png'),
  helicopter_layer:         require('./helicopter_layer.png'),
  jeep_layer:               require('./jeep_layer.png'),
  monstertruck_layer:       require('./monstertruck_layer.png'),
  moped_layer:              require('./moped_layer.png'),
  motorbike_layer:          require('./motorbike_layer.png'),
  policecar_layer:          require('./policecar_layer.png'),
  rocket_layer:             require('./rocket_layer.png'),
  sportcar_layer:           require('./sportcar_layer.png'),
  taxi_layer:               require('./taxi_layer.png'),
  train_layer:              require('./train_layer.png'),
  tram_layer:               require('./tram_layer.png'),
  trolleybus_layer:         require('./trolleybus_layer.png'),
  truck_layer:              require('./truck_layer.png'),
  'tuk-tuk_layer':          require('./tuk-tuk_layer.png'),

  // ── Dinosaurs ─────────────────────────────────────────────────────────────
  apatosaurus_layer:       require('./apatosaurus_layer.png'),
  archaeopteryx_layer:     require('./archaeopteryx_layer.png'),
  archaeornithomimus_layer:require('./archaeornithomimus_layer.png'),
  baryonyx_layer:          require('./baryonyx_layer.png'),
  carnotaurus_layer:       require('./carnotaurus_layer.png'),
  ceratosaurus_layer:      require('./ceratosaurus_layer.png'),
  compsognathus_layer:     require('./compsognathus_layer.png'),
  deinonychus_layer:       require('./deinonychus_layer.png'),
  dilophosaurus_layer:     require('./dilophosaurus_layer.png'),
  diplodocus_layer:        require('./diplodocus_layer.png'),
  giganotosaurus_layer:    require('./giganotosaurus_layer.png'),
  maiasaura_layer:         require('./maiasaura_layer.png'),
  microceratus_layer:      require('./microceratus_layer.png'),
  mosasaurus_layer:        require('./mosasaurus_layer.png'),
  pachycephalosaurus_layer:require('./pachycephalosaurus_layer.png'),
  pteranodon_layer:        require('./pteranodon_layer.png'),
  sauropelta_layer:        require('./sauropelta_layer.png'),
  spinosaurus_layer:       require('./spinosaurus_layer.png'),
  stegosaurus_layer:       require('./stegosaurus_layer.png'),
  stenopterygius_layer:    require('./stenopterygius_layer.png'),
  suchomimus_layer:        require('./suchomimus_layer.png'),
  therizinosaurus_layer:   require('./therizinosaurus_layer.png'),
  tyrannosaurus_layer:     require('./tyrannosaurus_layer.png'),
  velociraptor_layer:      require('./velociraptor_layer.png'),
};

/**
 * Get the layer (silhouette) image for a level name.
 * Mirrors ObjC: getPuzzleLayerImageName — name.lowercased() + "_layer" (spaces removed)
 */
export function getLayerImage(levelName: string): ImageSourcePropType | null {
  const key = levelName.toLowerCase().replace(/\s+/g, '') + '_layer';
  return layerImages[key] ?? null;
}
