// Manipulation of search-related data

import _ from 'lodash'
import ApolloClient from 'apollo-client-preset'
import gql from 'graphql-tag'

const client = new ApolloClient()

const state = {
  // list of objects with { text, weight, applyTo, active }
  keywords: [],
  results: [],
  searchComplete: false
}

const getters = {
  activeKeywords (state) {
    var kws = state.keywords.filter(kw => kw.active).map(k => _.clone(k))
    _.forEach(kws, k => delete k.active)
    return kws
  },
  inactiveKeywords (state) {
    var kws = state.keywords.filter(kw => !kw.active).map(k => _.clone(k))
    _.forEach(kws, k => delete k.active)
    return kws
  }
}

const actions = {
  addKeyword ({commit}, keyword) {
    commit('ADD_KEYWORD', keyword)
  },
  deactivateKeyword ({commit, state}, keyword) {
    var idx = _.findIndex(state.keywords, k => k.text == keyword.text)
    if (idx != -1) {
      commit('DEACTIVATE_KEYWORD', idx)
    }
  },
  activateKeyword ({commit, state}, keyword) {
    var idx = _.findIndex(state.keywords, k => k.text == keyword.text)
    if (idx != -1) {
      commit('ACTIVATE_KEYWORD', idx)
    }
  },
  removeKeyword ({commit, state}, keyword) {
    var idx = _.findIndex(state.keywords, k => k.text == keyword.text)
    if (idx != -1) {
      commit('DELETE_KEYWORD', keyword)
    }
  },
  runSearch ({commit, state, getters}) {
    var kw = getters.activeKeywords
    if (kw && kw.length) {
      state.searchComplete = false

      client.query({
        query: gql`
            query CourseSearch($deluxeKeywords: [DeluxeKeywordInput]) {
              courses(deluxe_keywords: $deluxeKeywords) {
                academic_group
                catalog_number
                component
                course_description_long
                id
                subject
                term_name
                term_year
                title
                units_maximum
                course_instructors {
                  display_name
                  id
                }
              }
            }
          `,
        variables: { deluxeKeywords: kw }
      })
        .then(response => {
          state.results = response.data.courses
          state.searchComplete = true
        })
    } else {
      state.results = []
    }
  }
}

const mutations = {
  ADD_KEYWORD (state, keyword) {
    if (!state.keywords.filter(k => k.text == keyword.text).length) {
      state.keywords.push(keyword)
    }
  },
  DEACTIVATE_KEYWORD (state, idx) {
    state.keywords[idx].active = false
  },
  ACTIVATE_KEYWORD (state, idx) {
    state.keywords[idx].active = true
  },
  DELETE_KEYWORD (state, idx) {
    state.keywords.splice(idx, 1)
  }
}

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations
}
