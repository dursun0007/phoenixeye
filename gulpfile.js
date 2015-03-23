var gulp = require('gulp');
var plumber = require('gulp-plumber');

var concat = require('gulp-concat');
var sourcemaps = require('gulp-sourcemaps');

var uglify = require('gulp-uglify');

var less = require('gulp-less');
var minifyCSS = require('gulp-minify-css');
var autoprefixer = require('gulp-autoprefixer');

var browserSync = require('browser-sync');

var files = {
	js: {
		dependencies: [
			'bower_components/angular/angular.min.js',
			'bower_components/angular-ui-router/release/angular-ui-router.min.js'
		],
		files: [
			'client/js/phoenixeye.js',
			'client/js/**/*.js'
		]
	},
	less: [
		'client/less/*.less'
	],
	html: [
		'client/index.html',
		'client/templates/*.html',
		'client/partials/*.html'
	]
};

gulp.task('js-dependencies', function () {
	return gulp.src(files.js.dependencies)
		.pipe(plumber())
		.pipe(concat('dependencies.js'))
		.pipe(uglify())
		.pipe(gulp.dest('client/dist'))
	;
});

gulp.task('js', function () {
	return gulp.src(files.js.files)
		.pipe(plumber())
		.pipe(sourcemaps.init())
		.pipe(concat('phoenixeye.js'))
		.pipe(uglify())
		.pipe(sourcemaps.write('.'))
		.pipe(gulp.dest('client/dist'))
	;
});

gulp.task('less', function () {
	return gulp.src(files.less)
		.pipe(plumber())
		.pipe(sourcemaps.init())
		.pipe(less())
		.pipe(minifyCSS())
		.pipe(autoprefixer()).pipe(concat('styles.css'))
		.pipe(sourcemaps.write('.'))
		.pipe(gulp.dest('client/dist'))
	;
});

gulp.task('browser-sync', function () {
	browserSync({
		proxy: 'localhost:3000',
		ui: false,
		open: false
	});
});

gulp.task('watch', ['browser-sync'], function () {
	gulp.watch(files.js.files, ['js', browserSync.reload]);
	gulp.watch(files.less, ['less', browserSync.reload]);
	gulp.watch(files.html).on('change', browserSync.reload);
});

gulp.task('default', ['js-dependencies', 'js', 'less']);