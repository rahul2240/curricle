// Manipulation of search-related data

import _ from 'lodash'
import apolloClient from 'apollo'
import COURSES_SEARCH_IDS_QUERY from '../../graphql/CoursesSearchIds.gql'
import COURSES_SEARCH_KEYWORDS_QUERY from '../../graphql/CoursesSearchKeywords.gql'

import { transformSchedule } from 'lib/util'

const thisYear = (new Date()).getUTCFullYear()

const state = {
  // list of objects with { text, weight, applyTo, active }
  keywords: [],
  results: [],
  searchComplete: false,
  applyToOptions: [
    { text: 'Title', value: 'TITLE' },
    { text: 'Description', value: 'DESCRIPTION' },
    { text: 'Instructor', value: 'INSTRUCTOR' },
    { text: 'Readings', value: 'READINGS', disabled: true },
    { text: 'Course ID', value: 'COURSE_ID' }
  ],
  weightOptions: [
    { text: '1', value: 1 },
    { text: '2', value: 2 },
    { text: '3', value: 3 },
    { text: '4', value: 4 },
    { text: '5', value: 5 },
    { text: '6', value: 6 },
    { text: '7', value: 7 },
    { text: '8', value: 8 },
    { text: '9', value: 9 }
  ],
  searchTermStart: 'Fall',
  searchTermEnd: 'Spring',
  searchYearStart: thisYear,
  searchYearEnd: thisYear + 1,
  searchTermUseRange: false
}

const getters = {
  activeKeywords: state => state.keywords.filter(kw => kw.active),
  inactiveKeywords: state => state.keywords.filter(kw => !kw.active)
}

const actions = {
  addKeyword ({commit}, keyword) {
    commit('ADD_KEYWORD', keyword)
  },
  deactivateKeyword ({commit, state}, keyword) {
    var idx = _.findIndex(state.keywords, k => k.text === keyword.text)
    if (idx !== -1) {
      commit('DEACTIVATE_KEYWORD', idx)
    }
  },
  activateKeyword ({commit, state}, keyword) {
    var idx = _.findIndex(state.keywords, k => k.text === keyword.text)
    if (idx !== -1) {
      commit('ACTIVATE_KEYWORD', idx)
    }
  },
  removeKeyword ({commit, state}, keyword) {
    var idx = _.findIndex(state.keywords, k => k.text === keyword.text)
    if (idx !== -1) {
      commit('DELETE_KEYWORD', keyword)
    }
  },
  runKeywordSearch ({commit, state, getters, dispatch}) {
    var kw = getters.activeKeywords.map(k => _.clone(k))
    _.forEach(kw, k => delete k.active)

    if (kw && kw.length) {
      state.searchComplete = false

      dispatch(
        'runSearch',
        {
          keywords: kw,
          handler: response => {
            state.results = response
            state.searchComplete = true
          }
        })
    } else {
      state.results = []
    }
  },
  runSearch ({commit, state, getters, dispatch}, {keywords, ids, handler}) {
    var vars = {}
    let query = ''

    if (ids && ids.length) {
      query = COURSES_SEARCH_IDS_QUERY
      vars.ids = ids
    } else if (keywords && keywords.length) {
      query = COURSES_SEARCH_KEYWORDS_QUERY
      vars.deluxeKeywords = keywords
    } else {
      console.error('runSearch: param errors')
      return
    }

    var promise = apolloClient.query({
      query: query,
      variables: vars
    }).then(response => {
      // standard transforms
      var courses = _.map(
        response.data.courses,
        c => {
          var o = _.clone(c)
          o.schedule = transformSchedule(o)
          o.semester = o.term_name + ' ' + o.term_year

          // TODO: Get from data; random for now
          o.department_color = '#' + Math.floor((Math.random() * (999 - 599)) + 600)
          return o
        })

      // store in registry
      dispatch('courses/registerCourses', courses, { root: true })

      return courses
      // finally run any user hanlder
    })

    promise.then(handler)
  }
}

const mutations = {
  ADD_KEYWORD (state, keyword) {
    if (!state.keywords.filter(k => k.text === keyword.text).length) {
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
