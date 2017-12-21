class CoursesController < ApplicationController

  def search
    search = Course.search do
      fulltext params[:keyword]? params[:keyword] : '', :fields => :title
      fulltext params[:keyword]? params[:keyword] : '', :fields => :course_description_long
      paginate :page => 1, :per_page => 50
    end    
    @courses = search.results
    render :json => @courses
  end

end
