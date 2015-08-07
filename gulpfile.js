var gulp = require('gulp');
var del = require('del');
var runSequence = require('run-sequence');

//You only need browserSync to serve, not to build.
var browserSync;
var reload;
try {
  browserSync = require('browser-sync');
  reload = browserSync.reload;
} catch (a) {
  console.log("No browserSync");
  console.log(a);
  reload = function() {};
};

//This is for github publishing from a local machine.
var extraArgs;
try {
  extraArgs = require('./sensitive/env.json');
} catch (a) {
  extraArgs = {};
};

var gulpLoadPlugins = require('gulp-load-plugins');

var $ = gulpLoadPlugins();

var bower = require('gulp-bower');

gulp.task('bower', function() {
  return bower()
    .pipe(gulp.dest('bower_components/'))
});

gulp.task('clean:all', ['clean', 'clean:dist'], del.bind(null, ['bower_components']));
gulp.task('clean', del.bind(null, ['.tmp', 'dist']));
gulp.task('clean:dist', del.bind(null, ['.publish', '.tmp/.publish']));

gulp.task('fonts', function() {
    var filterfont = $.filter('**/*.{eot,svg,ttf,woff,woff2}');
    return gulp.src('./bower.json')
        .pipe($.mainBowerFiles())
        .pipe(filterfont)
        //Possibly concat in app fonts here?
        .pipe($.flatten())
        .pipe(gulp.dest('.tmp/fonts')) //for serve
        .pipe(gulp.dest('dist/fonts'));
});

gulp.task('extras', function() {
  //favicon, and pictures.
  return gulp.src([
      'app/*.png',
      'LICENSE',
      'README.md',
    ], {
      dot: true
    })
    .pipe(gulp.dest('dist'));
});


function lint(files, options) {
  return function() {
    return gulp.src(files)
      .pipe(reload({stream: true, once: true}))
      .pipe($.eslint(options))
      .pipe($.eslint.format())
      .pipe($.if(!browserSync.active, $.eslint.failAfterError()));
  };
};

gulp.task('lint', lint('app/scripts/**/*.js'));

gulp.task('serve', ['fonts'], function() {
  browserSync({
    notify: false,
    port: 9000,
    server: {
      baseDir: ['.tmp', 'app'],
      routes: {
        '/bower_components': 'bower_components'
      }
    }
  });

  gulp.watch([
    'app/*.html',
    'app/scripts/**/*.js',
    'app/images/**/*',
    '.tmp/fonts/**/*'
  ]).on('change', reload);

  //gulp.watch('app/styles/**/*.scss', ['styles']);
  //gulp.watch('app/fonts/**/*', ['fonts']);
  gulp.watch('bower.json', ['fonts']);
});


gulp.task('html-v', function() {
  var assets = $.useref.assets({
    noconcat: true,
    searchPath: ['.tmp', 'app', '.']
  });

  var parts = gulp.src('app/*.html')
    .pipe(assets)
    .pipe($.flatten())

   var js = parts
    .pipe($.filter("*.js"))
    .pipe(gulp.dest('dist/raw/js'))
    .pipe($.uglify())
    .pipe(gulp.dest('dist/min/js'))

  return js;

});

gulp.task('html', function() {
  var assets = $.useref.assets({
    searchPath: ['.tmp', 'app', '.']
  });

  var jsFilter = $.filter('**/*.js', {restore: true});
  var cssFilter = $.filter('**/*.css', {restore: true});

  return gulp.src('app/*.html')
    .pipe(assets)
    //filtr js
    .pipe(jsFilter)
    .pipe($.ngAnnotate())
    .pipe($.uglify())
    .pipe(jsFilter.restore)
    //CSS
    //.pipe(cssFilter)
    //TODO: This isn't "just working" for some reason
    //.pipe($.minifyCss({compatibility: '*'}))
    //.pipe(cssFilter.restore)
    .pipe(assets.restore())
    .pipe($.useref())
    //html
    .pipe($.if('*.html', $.minifyHtml({conditionals: true, loose: true})))
    .pipe(gulp.dest('dist'));
});

gulp.task('build', function() {
  runSequence(
    'bower',
    'clean',
    ['html', 'fonts', 'extras']
  );
  //dump some size info
  return gulp.src('dist/**/*').pipe($.size({title: 'build', gzip: true}));
});

gulp.task('test', function() {
  //TODO: Guess I should do something here - but hey, it at least requires
  //a build to pass!
  return;
});

gulp.task('gh-pages', ['clean:dist'], function() {

  var token = process.env.GH_TOKEN || extraArgs.GH_TOKEN;
  var ref = process.env.GH_REF || extraArgs.GH_REF;
  var branch = process.env.GH_BRANCH || extraArgs.GH_BRANCH;

  //TODO: calculate cname from gh_ref
  var cname = process.env.CNAME || extraArgs.CNAME;
  
  var options = {
    remoteUrl: "https://" +token +"@" + ref,
    branch: branch,
    cacheDir: ".tmp/.publish",
  };

  gulp.src('./**/*')
    .pipe($.debug({title: "gory-detail"}))

  return gulp.src('./dist/**/*')
    .pipe($.file("CNAME", cname))
    .pipe($.debug({title: "gh-pages"}))
    .pipe($.ghPages(options));
});

gulp.task('default', ['clean'], function() {
  gulp.start('build');
});

gulp.task('dist', function() {
  //I get a bit confused about how dependencies work
  //But basically only run this after a build.
  runSequence(
    'gh-pages'
  )
})
