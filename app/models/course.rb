class Course < ApplicationRecord
  include PgSearch

  has_many :course_meeting_patterns
  has_many :course_instructors

  searchable do
    integer :id
    integer :external_course_id
    text :title
    string :term_name
    integer :term_year
    integer :academic_year
    string :class_section
    string :component
    integer :prereq
    string :subject
    text :subject_description
    string :subject_description
    text :subject_academic_org_description
    text :academic_group
    string :academic_group
    text :academic_group_description
    text :grading_basis_description
    string :term_pattern_code
    text :term_pattern_description
    integer :units_maximum
    integer :catalog_number
    text :course_description
    text :course_description_long
    text :course_note
    text :class_academic_org_description
    string :class_academic_org_description
    join(:class_meeting_number, target:  CourseMeetingPattern, type: :string, join: { from: :course_id, to: :id })
    join(:meeting_time_start, target: CourseMeetingPattern, type: :integer, join: { from: :course_id, to: :id })
    join(:meeting_time_end, target: CourseMeetingPattern, type: :integer, join: { from: :course_id, to: :id })
    join(:meets_on_monday, target: CourseMeetingPattern, type: :boolean, join: { from: :course_id, to: :id })
    join(:meets_on_tuesday, target: CourseMeetingPattern, type: :boolean, join: { from: :course_id, to: :id })
    join(:meets_on_wednesday, target: CourseMeetingPattern, type: :boolean, join: { from: :course_id, to: :id })
    join(:meets_on_thursday, target: CourseMeetingPattern, type: :boolean, join: { from: :course_id, to: :id })
    join(:meets_on_friday, target: CourseMeetingPattern, type: :boolean, join: { from: :course_id, to: :id })
    join(:meets_on_saturday, target: CourseMeetingPattern, type: :boolean, join: { from: :course_id, to: :id })
    join(:meets_on_sunday, target: CourseMeetingPattern, type: :boolean, join: { from: :course_id, to: :id })
    join(:start_date, target: CourseMeetingPattern, type: :date, join: { from: :course_id, to: :id })
    join(:end_date, target: CourseMeetingPattern, type: :date, join: { from: :course_id, to: :id })
    join(:external_facility_id, target: CourseMeetingPattern, type: :string, join: { from: :course_id, to: :id })
    join(:facility_description, target: CourseMeetingPattern, type: :string, join: { from: :course_id, to: :id })
    join(:first_name, target: CourseInstructor, type: :text, join: {from: :course_id, to: :id })
    join(:last_name, target: CourseInstructor, type: :text, join: {from: :course_id, to: :id })
  end

  pg_search_scope :search_for, lambda { |query_filters|
    query = {
      query: query_filters[:keywords],
      against: [],
      associated_against: {},
      using: {
        tsearch: {
          dictionary: "english",
          any_word: true,
          prefix: true
        }
      }
    }

    # build against/associated_against options based on selected keyword options
    query_filters[:keyword_options].map { |field|
      if map = Course.keyword_options_map[field.to_sym]
        if db_field = map[:db_field]
          if db_field[:table] == :courses
            Array(db_field[:columns]).each do |col|
              query[:against] << col
            end
          else
            query[:associated_against][db_field[:table]] = db_field[:columns]
          end
        end
      end
    }

    query[:against] = %w(title course_description_long) if query[:against].empty? && query[:associated_against].empty?

    query
  }

  scope :return_as_relation, ->(search_results) do
    matching_item_ids = search_results.hits.map(&:primary_key)
    where :id => matching_item_ids 
    #Course.left_outer_joins(:course_meeting_patterns).where(:id => matching_item_ids) + Course.left_outer_joins(:course_meeting_patterns).where(:course_id => matching_item_ids)
  end

  def self.for_day(day, query_params = {})
    query_params[:id] = CourseMeetingPattern.select(:course_id).where("meets_on_#{day}": true)
    
    # search = Sunspot.search(CourseMeetingPattern) do
    #   with("meets_on_#{day}", true)
    # end
    # query_params[:id] = search.results[:course_id]

    Course.where(query_params).distinct

    # result = Sunspot.search(Course) do
    #   with(:subject_academic_org_description, query_params[:subject_academic_org_description])
    # end
    # result #to do, make sure that it returns distinct values
  end

  def self.subject_groups(query = nil)
    # TODO: figure out if we can replace uniq with distinct
    query.pluck(:subject_academic_org_description).uniq
  end

  def self.schools
    order(:academic_group).distinct.pluck(:academic_group)
  end

  def self.departments
    order(:class_academic_org_description).distinct.pluck(:class_academic_org_description)
  end

  def self.subject_descriptions
    order(:subject_description).distinct.pluck(:subject_description)
  end

  def self.component_types
    order(:component).distinct.pluck(:component)
  end

  def self.terms
    select('DISTINCT on (term_name,term_year) term_name, term_year').where("term_year >= ?", Date.today.year).order(term_year: :asc, term_name: :desc).map { |term|
      "#{term.term_name}_#{term.term_year}"
    }
  end

  def meeting
    course_meeting_patterns.find_by(
      term_name: term_name,
      term_year: term_year,
      class_section: class_section
    )
  end

  def instructor
    course_instructors.find_by(
      term_name: term_name,
      term_year: term_year,
      class_section: class_section
    )
  end

  def subject_and_catalog
    "#{subject} #{catalog_number}"
  end

  # Users can select from a set of keyword options to query against. This is a map of those
  # options, their metadata, and their related fields in the database
  def self.keyword_options_map
    {
      title: {
        display: 'Title',
        default: true,
        db_field: {
          table: :courses,
          columns: [:title]
        }
      },
      description: {
        display: 'Description',
        default: true,
        db_field: {
          table: :courses,
          columns: [:course_description_long]
        }
      },
      instructor: {
        display: 'Instructor',
        default: false,
        db_field: {
          table: :course_instructors,
          columns: [:first_name, :last_name]
        }
      }
      #library: {
      #  display: 'Library reserves',
      #  default: false
      #}
    }
  end

  # Used to setup and optionally populate the schedule mapping used in the schedule filter
  def self.schedule_filter_map(values = {})
    {
      monday: {
        min: values["monday_min"],
        max: values["monday_max"]
      },
      tuesday: {
        min: values["tuesday_min"],
        max: values["tuesday_max"]
      },
      wednesday: {
        min: values["wednesday_min"],
        max: values["wednesday_max"]
      },
      thursday: {
        min: values["thursday_min"],
        max: values["thursday_max"]
      },
      friday: {
        min: values["friday_min"],
        max: values["friday_max"]
      }
    }
  end
end
