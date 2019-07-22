const acts = [{
  title: "The Market",
  description: "In which the player grapples with the city's housing market.",
  colors: ["#F06C8F", "#2972EC"],
  startScene: "intro"
}, {
  title: "Discovering DOMA",
  description: "In which the player learns about a new model for housing.",
  colors: ["#6CF0CC", "#ECA329"],
  startScene: "eviction"
}];

const scenes = {
  "intro": {
    title: "Another day in the city",
    model: "placeholder",
    location: "city",
    description: "You roll out of bed, get ready for work, and make your way to the subway.",
    actions: [{
      name: "Commute to work",
      outcomes: [{
        id: "commuteToWork"
      }]
    }]
  },

  "commuteToWork": {
    title: "Commute",
    model: "subway",
    location: "subway",
    description: "On your way to work...",
    actions: [{
      name: "Arrive at the office",
      outcomes: [{
        id: "office"
      }]
    }]
  },

  "office": {
    title: "Work",
    model: "placeholder",
    location: "work",
    description: "You settle in at work. Your co-worker Alex comes up to you, eager to talk.",
    actions: [{
      name: "Talk to Alex",
      outcomes: [{
        id: "domaTalk"
      }]
    }]
  },

  "domaTalk": {
    title: "Alex",
    model: "placeholder",
    location: "work",
    description: "Hey, let me tell you about DOMA",
    actions: [{
      name: "Thanks, but I'm busy",
      outcomes: [{
        id: "domaTalkEnd"
      }]
    }]
  },

  "domaTalkEnd": {
    title: "Work",
    model: "placeholder",
    location: "work",
    description: "Alex takes the hint and leaves you alone. You click away at your desk, and after several hours the day is over. Time to head home.",
    actions: [{
      name: "Head home",
      outcomes: [{
        id: "commuteToHome"
      }]
    }]
  },

  "commuteToHome": {
    title: "Commute",
    model: "subway",
    location: "subway",
    description: "On your way home...",
    actions: [{
      name: "Arrive home",
      outcomes: [{
        id: "eviction"
      }]
    }]
  },


  "eviction": {
    title: "Evicted",
    model: "placeholder",
    location: "home",
    description: "When you get back to your apartment, you find a note under the door. You've been evicted. You have to find another place to live.",
    actions: [{
      name: "Ok...",
      outcomes: [{
        id: "SEARCH_APARTMENTS",
        nextSceneId: (success) => success ? 'moveIn': 'couch'
      }]
    }]
  },

  "moveIn": {
    title: "Moving in",
    model: "placeholder",
    location: "home",
    description: (state) => "It wasn't easy, but you found a new place. The apartment is {size}, MORE DYNAMIC DESCRIPTIONS. After you've brought everything inside, you decide to familiarize yourself with the area.",
    actions: [{
      name: "Walk around the block",
      outcomes: [{
        id: "exploreNeighborhood"
      }]
    }]
  },

  "couch": {
    title: "Couch crashing",
    model: "placeholder",
    location: "home",
    description: (state) => `You looked, but there weren't any affordable vacancies. For now, you're crashing on a friend's couch in ${state.neighborhood}. You decide to explore the area bit.`,
    actions: [{
      name: "Walk around the block",
      outcomes: [{
        id: "exploreNeighborhood"
      }]
    }]
  },

  "exploreNeighborhood": {
    title: "The neighborhood",
    model: "placeholder",
    location: "city",
    description: (state) => "DYNAMIC DESCRIPTION OF NEIGHBORHOOD",
    actions: [{
      name: "Turn in for the night",
      outcomes: [{
        id: "END_TURN",
        nextSceneId: "morning"
      }]
    }]
  },

  "morning": {
    title: "Morning",
    model: "placeholder",
    location: "home",
    description: "morning",
    actions: [{
      name: "loop",
      outcomes: [{
        id: "END_TURN",
        nextSceneId: "morning"
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
  },
  subway: {
    stageColor: "#000000",
    bodyColor: "#222222",
    textColor: "#ffffff",
  },
  home: {
    stageColor: "#FDBB1F",
    bodyColor: "#FFFF9F"
  }
}

export default {acts, scenes, locations};
