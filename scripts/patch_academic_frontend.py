with open('frontend/app/academic/page.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Update CourseItem interface and StudentItem interface
code = code.replace(
"""interface CourseItem {
  id: number;
  course_code: string;
  course_name: string;
  department: string;
  degree_level: string;
  total_semesters: number;
  is_active: boolean;
}""",
"""interface CourseItem {
  id: number;
  code?: string;
  course_code?: string;
  name?: string;
  course_name?: string;
  department?: string;
  description?: string;
  degree_level?: string;
  total_semesters?: number;
  is_active: boolean;
  student_count?: number;
  faculty_count?: number;
  subject_count?: number;
}"""
)

# 2. Update StudentItem interface to include photo_url
code = code.replace(
"""  biometric_enrolled: boolean;
  biometric_face_count: number;""",
"""  biometric_enrolled: boolean;
  biometric_face_count: number;
  photo_url?: string | null;"""
)

# 3. Update Courses card render
old_courses_render = """          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses
              .filter(
                (c) =>
                  !courseSearch ||
                  c.course_name.toLowerCase().includes(courseSearch.toLowerCase()) ||
                  c.course_code.toLowerCase().includes(courseSearch.toLowerCase())
              )
              .map((course) => (
                <div
                  key={course.id}
                  className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-lg">
                      {course.course_code}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        course.is_active ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {course.is_active ? "Active" : "Archived"}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{course.course_name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{course.department}</p>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono border-t border-slate-100 pt-2 flex items-center justify-between">
                    <span>{course.degree_level} Degree</span>
                    <span>{course.total_semesters} Semesters</span>
                  </div>
                </div>
              ))}
          </div>"""

new_courses_render = """          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses
              .filter((c) => {
                const q = courseSearch.toLowerCase();
                const code = (c.course_code || c.code || "").toLowerCase();
                const name = (c.course_name || c.name || "").toLowerCase();
                return !courseSearch || code.includes(q) || name.includes(q);
              })
              .map((course) => {
                const code = course.course_code || course.code || "COURSE";
                const name = course.course_name || course.name || "Academic Program";
                const dept = course.department || course.description || "Computer Science & Engineering";
                const degree = course.degree_level || "B.Tech";
                const semesters = course.total_semesters || 8;

                return (
                  <div
                    key={course.id}
                    className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-3 hover:border-blue-300 transition"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-lg">
                        {code}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          course.is_active ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {course.is_active ? "Active" : "Archived"}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{name}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{dept}</p>
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono border-t border-slate-100 pt-2 flex items-center justify-between">
                      <span className="font-semibold text-slate-700">{degree} Degree</span>
                      <span>{semesters} Semesters</span>
                    </div>
                  </div>
                );
              })}
          </div>"""

code = code.replace(old_courses_render, new_courses_render)

# 4. Update Viewfinder to show trained photo when student has enrolled face
old_viewfinder = """              {!webcamActive && !capturedImage && (
                <div className="text-center p-6 space-y-2">
                  <ScanFace className="w-8 h-8 text-blue-600 mx-auto" />
                  <p className="text-xs font-bold text-slate-800">Camera Ready</p>
                  <p className="text-[11px] text-slate-400">Click &ldquo;Start Camera&rdquo; below to snap face.</p>
                </div>
              )}"""

new_viewfinder = """              {!webcamActive && !capturedImage && selectedStudentForEnroll?.biometric_enrolled ? (
                <div className="relative w-full h-full">
                  <img
                    src={`${API_BASE_URL.replace('/api', '')}/api/academic/students/${selectedStudentForEnroll.id}/photo`}
                    alt="Trained Biometric Face"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-emerald-600/90 text-white text-[10px] font-bold shadow-md backdrop-blur-xs flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                    <span>Trained Photo on File</span>
                  </div>
                  <div className="absolute bottom-3 left-3 right-3 bg-slate-900/80 backdrop-blur-md rounded-xl p-2 text-white flex items-center justify-between text-[11px]">
                    <span className="font-mono text-cyan-300">128-D SFace Vector Active</span>
                    <span className="text-emerald-400 font-bold">Verified Profile</span>
                  </div>
                </div>
              ) : !webcamActive && !capturedImage ? (
                <div className="text-center p-6 space-y-2">
                  <ScanFace className="w-8 h-8 text-blue-600 mx-auto" />
                  <p className="text-xs font-bold text-slate-800">Camera Ready</p>
                  <p className="text-[11px] text-slate-400">Click &ldquo;Start Camera&rdquo; or &ldquo;Upload File&rdquo; to train biometrics.</p>
                </div>
              ) : null}"""

code = code.replace(old_viewfinder, new_viewfinder)

# 5. Update Campus Smart ID card image
old_smart_id_img = """                      <div className="w-12 h-14 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                        {capturedImage || selectedStudentForEnroll.biometric_enrolled ? (
                          <img src={capturedImage || "/placeholder.png"} alt="ID" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-5 h-5 text-slate-400" />
                        )}
                      </div>"""

new_smart_id_img = """                      <div className="w-12 h-14 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                        <img
                          src={
                            capturedImage ||
                            `${API_BASE_URL.replace('/api', '')}/api/academic/students/${selectedStudentForEnroll.id}/photo`
                          }
                          alt="ID"
                          className="w-full h-full object-cover"
                        />
                      </div>"""

code = code.replace(old_smart_id_img, new_smart_id_img)

with open('frontend/app/academic/page.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print('Updated frontend/app/academic/page.tsx successfully')

