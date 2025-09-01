"""
Setup configuration for hello_world Flask application.

This setup.py file converts the original Node.js package.json metadata 
to Python packaging format, enabling pip-installable distribution while
preserving all original project metadata (name, version, author, license).
"""

from setuptools import setup, find_packages

# Package metadata converted from original package.json
setup(
    # Core package identification - preserved from Node.js package.json
    name="hello_world",
    version="1.0.0",
    
    # Description updated for Python Flask context
    description="Hello world in Python Flask",
    long_description="A simple Flask web application that serves 'Hello, World!' responses. "
                    "This is a Python Flask migration of the original Node.js HTTP server, "
                    "maintaining exact feature parity and behavioral compatibility.",
    long_description_content_type="text/plain",
    
    # Author and license preserved from original package.json
    author="hxu",
    license="MIT",
    
    # Python-specific package configuration
    python_requires=">=3.6",
    packages=find_packages(),
    include_package_data=True,
    
    # Flask dependency specification as required for web server functionality
    install_requires=[
        "Flask>=3.1.2",
    ],
    
    # Python package classifiers for PyPI compatibility
    classifiers=[
        "Development Status :: 5 - Production/Stable",
        "Environment :: Web Environment",
        "Framework :: Flask",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.6",
        "Programming Language :: Python :: 3.7",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Topic :: Internet :: WWW/HTTP :: Dynamic Content",
        "Topic :: Internet :: WWW/HTTP :: HTTP Servers",
        "Topic :: Software Development :: Libraries :: Application Frameworks",
    ],
    
    # Entry points for command-line execution
    entry_points={
        "console_scripts": [
            "hello-world=app:main",
        ],
    },
    
    # Keywords for package discovery
    keywords="flask web server http hello world migration nodejs python",
    
    # Project URLs for documentation and source
    project_urls={
        "Source": "https://github.com/hxu/hello_world",
        "Bug Reports": "https://github.com/hxu/hello_world/issues",
    },
)