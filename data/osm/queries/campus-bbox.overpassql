// south, west, north, east; includes the campus and nearby roads.
[out:json][timeout:120][bbox:32.1099,118.9442,32.1297,118.9621];
(
  nwr[highway];
  nwr[building];
  nwr["building:part"];
  nwr[landuse];
  nwr[leisure];
  nwr[natural];
  nwr[water];
  nwr[waterway];
  nwr[amenity];
  nwr[shop];
  nwr[name];
  nwr["name:zh"];
  way(89910837);
);
// Fetch all members/nodes, including buildings with courtyards.
(._; >>;);
out meta;
