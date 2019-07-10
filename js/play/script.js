const acts = [{
  title: "The Market",
  description: "In which the player grapples with the city's housing market.",
  colors: ["#F06C8F", "#2972EC"],
  startScene: "eviction"
}, {
  title: "Discovering DOMA",
  description: "In which the player learns about a new model for housing.",
  colors: ["#6CF0CC", "#ECA329"],
  startScene: "eviction"
}];

const scenes = {
  "eviction": {
    title: "Evicted",
    model: "subway",
    location: "city",
    description: "You've been evicted. You have to find another place to live.",
    actions: [{
      name: "Ok",
      outcomes: [{
        id: "search_apartment"
      }]
    }, {
      name: "Skip",
      outcomes: []
    }]
  },

  // TODO this should be a special scene,
  // since it requires particular functionality
  "search_apartment": {
    title: "Search Apartment (PLACEHOLDER)",
    model: "apartment",
    location: "work",
    description: "PLACEHOLDER",
    actions: [{
      name: "Ok",
      outcomes: [{
        id: "search_apartment",
        p: 0.5
      }, {
        id: "eviction",
        p: () => 0.5
      }]
    }]

  }
};

const locations = {
  city: {
    stageColor: "#DBDBDB",
    bodyColor: "#E6E6E6"
  },
  work: {
    stageColor: "#CCE4C6",
    bodyColor: "#E0E9ED"
  },
  travel: {
    stageColor: "#F9CE8F",
    bodyColor: "#F8D0B9"
  }
}

export default {acts, scenes, locations};
